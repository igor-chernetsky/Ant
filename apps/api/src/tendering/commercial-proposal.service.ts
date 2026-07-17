import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BidStatus, DocumentStatus, Prisma } from '@prisma/client';
import { PassThrough } from 'stream';
import { ZipArchive } from 'archiver';
import { PrismaService } from '../prisma/prisma.service';
import { HtmlToPdfService } from '../pdf/html-to-pdf.service';
import { StorageService } from '../storage/storage.service';
import { ProjectLocalizationService } from '../localization/project-localization.service';
import { normalizeSourceLocale } from '../localization/locale.utils';
import {
  DEFAULT_LOCALE,
  type SupportedLocale,
} from '../users/locale.types';
import { ContractorProfilesService } from './contractor-profiles.service';
import {
  buildCommercialProposalData,
  renderCommercialProposalHtml,
} from './commercial-proposal.template';
import { BidTermsV1, BidContractTerms } from './tendering.types';
import { normalizeContractTerms } from './commercial-proposal.template';
import {
  commercialProposalCopy,
  parseCommercialProposalLocales,
} from './commercial-proposal.i18n';

const CLIENT_DOWNLOADABLE_BID_STATUSES: BidStatus[] = [
  BidStatus.submitted,
  BidStatus.selected,
  BidStatus.rejected,
];

type LoadedBid = Prisma.BidGetPayload<{
  include: {
    contractor: { include: { user: true } };
    tender: { include: { project: { include: { client: true } } } };
  };
}>;

interface ZipEntry {
  name: string;
  buffer: Buffer;
}

function slugifyProjectTitle(title: string, fallback: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || fallback
  );
}

function sanitizeZipEntryName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'file';
}

function uniqueZipName(baseName: string, used: Set<string>): string {
  let candidate = baseName;
  let index = 2;
  while (used.has(candidate)) {
    const dot = baseName.lastIndexOf('.');
    if (dot > 0) {
      candidate = `${baseName.slice(0, dot)}-${index}${baseName.slice(dot)}`;
    } else {
      candidate = `${baseName}-${index}`;
    }
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

async function buildZipBuffer(entries: ZipEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    archive.on('error', reject);
    archive.pipe(stream);

    for (const entry of entries) {
      archive.append(entry.buffer, { name: entry.name });
    }

    void archive.finalize();
  });
}

@Injectable()
export class CommercialProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly htmlToPdf: HtmlToPdfService,
    private readonly storage: StorageService,
    private readonly projectLocalization: ProjectLocalizationService,
  ) {}

  async countAttachments(
    userId: string,
    bidId: string,
    projectId?: string,
  ): Promise<number> {
    const bid = await this.loadAndAuthorizeBid(userId, bidId, projectId);
    const attachments = await this.collectAttachmentFiles(bid.tender.projectId);
    return attachments.length;
  }

  async renderPdf(
    userId: string,
    bidId: string,
    projectId?: string,
    viewerLocale?: SupportedLocale,
  ): Promise<{ pdf: Buffer; fileName: string }> {
    const { html, fileName } = await this.buildHtmlDocument(
      userId,
      bidId,
      projectId,
      viewerLocale,
    );
    const pdf = await this.htmlToPdf.render(html);
    return { pdf, fileName };
  }

  async renderDownload(
    userId: string,
    bidId: string,
    projectId: string | undefined,
    options: {
      locales: SupportedLocale[];
      withAttachments: boolean;
    },
  ): Promise<{
    buffer: Buffer;
    fileName: string;
    contentType: string;
  }> {
    const locales =
      options.locales.length > 0
        ? options.locales
        : ([DEFAULT_LOCALE] as SupportedLocale[]);
    const multiLocale = locales.length > 1;
    const needsZip = options.withAttachments || multiLocale;

    if (!needsZip) {
      const { pdf, fileName } = await this.renderPdf(
        userId,
        bidId,
        projectId,
        locales[0],
      );
      return {
        buffer: pdf,
        fileName,
        contentType: 'application/pdf',
      };
    }

    if (options.withAttachments && !this.storage.isConfigured()) {
      throw new ServiceUnavailableException(
        'File storage is not configured. Cannot bundle attachments.',
      );
    }

    const bid = await this.loadAndAuthorizeBid(userId, bidId, projectId);
    const usedNames = new Set<string>();
    const entries: ZipEntry[] = [];

    for (const locale of locales) {
      const { pdf, fileName } = await this.renderPdf(
        userId,
        bidId,
        projectId,
        locale,
      );
      const localizedName = multiLocale
        ? fileName.replace(/\.pdf$/i, `-${locale}.pdf`)
        : fileName;
      entries.push({
        name: uniqueZipName(localizedName, usedNames),
        buffer: pdf,
      });
    }

    if (options.withAttachments) {
      const attachmentFiles = await this.collectAttachmentFiles(
        bid.tender.projectId,
      );
      for (const file of attachmentFiles) {
        try {
          const buffer = await this.storage.getObjectBuffer(file.storageKey);
          entries.push({
            name: uniqueZipName(file.zipPath, usedNames),
            buffer,
          });
        } catch {
          // Skip files that cannot be read; contract PDF still downloads.
        }
      }
    }

    const zip = await buildZipBuffer(entries);
    const slug = slugifyProjectTitle(
      bid.tender.project.title,
      bidId.slice(0, 8),
    );
    const suffix = options.withAttachments
      ? multiLocale
        ? '-multilang-with-attachments'
        : '-with-attachments'
      : '-multilang';
    return {
      buffer: zip,
      fileName: `contract-draft-${slug}${suffix}.zip`,
      contentType: 'application/zip',
    };
  }

  async renderZip(
    userId: string,
    bidId: string,
    projectId?: string,
    viewerLocale?: SupportedLocale,
  ): Promise<{ zip: Buffer; fileName: string }> {
    const result = await this.renderDownload(userId, bidId, projectId, {
      locales: viewerLocale ? [viewerLocale] : [],
      withAttachments: true,
    });
    return { zip: result.buffer, fileName: result.fileName };
  }

  private async loadAndAuthorizeBid(
    userId: string,
    bidId: string,
    projectId?: string,
  ): Promise<LoadedBid> {
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        contractor: { include: { user: true } },
        tender: { include: { project: { include: { client: true } } } },
      },
    });

    if (!bid) {
      throw new NotFoundException('Bid not found');
    }

    if (projectId && bid.tender.projectId !== projectId) {
      throw new NotFoundException('Bid not found for this project');
    }

    if (bid.amount == null) {
      throw new BadRequestException('Bid has no contract amount');
    }

    const isClient = bid.tender.project.clientId === userId;
    const profile = await this.contractorProfiles.getByUserId(userId);
    const isContractor = profile?.id === bid.contractorId;

    if (!isClient && !isContractor) {
      throw new ForbiddenException('Access denied');
    }

    if (isClient) {
      if (!CLIENT_DOWNLOADABLE_BID_STATUSES.includes(bid.status)) {
        throw new BadRequestException(
          'Commercial proposal document is available after the bid is submitted',
        );
      }
    } else if (
      bid.status !== BidStatus.selected ||
      bid.tender.awardedBidId !== bidId
    ) {
      throw new ForbiddenException(
        'Commercial proposal download is available only to the selected contractor',
      );
    }

    return bid;
  }

  private async collectAttachmentFiles(projectId: string): Promise<
    Array<{
      storageKey: string;
      zipPath: string;
    }>
  > {
    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      select: { id: true },
    });

    const [projectDocuments, clarificationAttachments] = await Promise.all([
      this.prisma.document.findMany({
        where: {
          projectId,
          status: DocumentStatus.uploaded,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          storageKey: true,
          originalName: true,
          category: true,
        },
      }),
      tender
        ? this.prisma.clarificationAnswerAttachment.findMany({
            where: {
              status: DocumentStatus.uploaded,
              question: { tenderId: tender.id },
            },
            orderBy: { createdAt: 'asc' },
            select: {
              storageKey: true,
              originalName: true,
              question: {
                select: {
                  id: true,
                  questionText: true,
                  sortOrder: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const files: Array<{ storageKey: string; zipPath: string }> = [];

    for (const doc of projectDocuments) {
      const category = doc.category.replace(/_/g, '-');
      files.push({
        storageKey: doc.storageKey,
        zipPath: `project-documents/${category}-${sanitizeZipEntryName(doc.originalName)}`,
      });
    }

    for (const attachment of clarificationAttachments) {
      const questionLabel = `Q${attachment.question.sortOrder + 1}`;
      const questionFolder = sanitizeZipEntryName(
        `${questionLabel}-${attachment.question.questionText.slice(0, 40)}`,
      );
      files.push({
        storageKey: attachment.storageKey,
        zipPath: `clarification-attachments/${questionFolder}/${sanitizeZipEntryName(attachment.originalName)}`,
      });
    }

    return files;
  }

  private async buildHtmlDocument(
    userId: string,
    bidId: string,
    projectId?: string,
    viewerLocale?: SupportedLocale,
  ): Promise<{ html: string; fileName: string }> {
    const bid = await this.loadAndAuthorizeBid(userId, bidId, projectId);

    const terms = (bid.termsJson as BidTermsV1 | null) ?? null;
    const project = bid.tender.project;
    const targetLocale = viewerLocale ?? normalizeSourceLocale(project.sourceLocale);
    const copy = commercialProposalCopy(targetLocale);

    const projectTerms =
      normalizeContractTerms(
        project.tenderContractTermsJson as BidContractTerms | undefined,
      ) ?? {};
    const mergedTerms: BidTermsV1 | null = terms
      ? {
          ...terms,
          scopeSummary: terms.scopeSummary ?? project.scopeSummary ?? undefined,
          contractTerms: {
            ...projectTerms,
            ...terms.contractTerms,
          },
        }
      : project.scopeSummary || Object.keys(projectTerms).length > 0
        ? {
            scopeSummary: project.scopeSummary ?? undefined,
            contractTerms: projectTerms,
          }
        : null;

    const localized =
      await this.projectLocalization.localizeCommercialProposalContent(
        project.id,
        bidId,
        {
          title: project.title,
          description: project.description,
          district: project.district,
          scopeSummary: mergedTerms?.scopeSummary ?? project.scopeSummary,
          clarificationSummary: project.clarificationSummary,
          approach: mergedTerms?.approach ?? null,
          notes: mergedTerms?.notes ?? null,
          contractTerms: mergedTerms?.contractTerms ?? projectTerms,
          lineItems: mergedTerms?.lineItems,
        },
        targetLocale,
      );

    const localizedMergedTerms: BidTermsV1 | null = mergedTerms
      ? {
          ...mergedTerms,
          scopeSummary: localized.scopeSummary ?? undefined,
          approach: localized.approach ?? undefined,
          notes: localized.notes ?? undefined,
          contractTerms: localized.contractTerms,
          lineItems: localized.lineItems.length
            ? localized.lineItems
            : mergedTerms.lineItems,
        }
      : localized.scopeSummary || Object.keys(localized.contractTerms).length > 0
        ? {
            scopeSummary: localized.scopeSummary ?? undefined,
            contractTerms: localized.contractTerms,
            lineItems: localized.lineItems,
          }
        : null;

    const projectDocuments = await this.prisma.document.findMany({
      where: {
        projectId: bid.tender.projectId,
        status: DocumentStatus.uploaded,
      },
      orderBy: { createdAt: 'asc' },
      select: { originalName: true, category: true },
    });

    const contract = await this.prisma.contract.findUnique({
      where: { bidId },
      select: {
        clientSignedAt: true,
        contractorSignedAt: true,
        clientSignatureDataUrl: true,
        contractorSignatureDataUrl: true,
      },
    });

    const data = buildCommercialProposalData({
      projectTitle: localized.title || project.title,
      projectDistrict: localized.district ?? project.district,
      projectDescription: localized.description,
      clarificationSummary: localized.clarificationSummary,
      bidAmount: Number(bid.amount),
      durationDays: bid.durationDays,
      terms: localizedMergedTerms,
      projectDocuments: projectDocuments.map((doc) => ({
        originalName: doc.originalName,
        category: doc.category,
      })),
      employerName:
        localized.contractTerms.employerName?.trim() ||
        project.client.displayName ||
        bid.tender.project.client.email ||
        copy.employerFallback,
      employerEmail: project.client.email,
      employerDisplayName: project.client.displayName,
      contractorCompanyName:
        bid.contractor.companyName ?? copy.contractorFallback,
      submittedAt: bid.submittedAt?.toISOString() ?? null,
      locale: targetLocale,
      contractorSignatureDataUrl: contract?.contractorSignatureDataUrl,
      employerSignatureDataUrl: contract?.clientSignatureDataUrl,
      contractorSignedAt: contract?.contractorSignedAt?.toISOString() ?? null,
      employerSignedAt: contract?.clientSignedAt?.toISOString() ?? null,
    });

    const html = renderCommercialProposalHtml(data);
    const slug = slugifyProjectTitle(
      localized.title || project.title,
      bidId.slice(0, 8),
    );
    const fileName = `contract-draft-${slug}.pdf`;

    return { html, fileName };
  }
}
