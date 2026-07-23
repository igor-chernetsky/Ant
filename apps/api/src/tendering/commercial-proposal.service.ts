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
  englishContractClosingHtml,
  renderCommercialProposalHtml,
  renderMultilingualCommercialProposalHtml,
  wrapEnglishContractBodyForPdf,
} from './commercial-proposal.template';
import type { CommercialProposalRenderData } from './commercial-proposal.types';
import { BidTermsV1, BidContractTerms } from './tendering.types';
import { normalizeContractTerms } from './commercial-proposal.template';
import {
  commercialProposalCopy,
  parseCommercialProposalLocales,
  sortCommercialProposalLocales,
} from './commercial-proposal.i18n';
import {
  extractBodyInnerHtml,
  stripContractSignaturesBlock,
} from './contract-html.sanitize';

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
        ? sortCommercialProposalLocales(options.locales)
        : ([DEFAULT_LOCALE] as SupportedLocale[]);
    const multiLocale = locales.length > 1;
    const needsZip = options.withAttachments;

    if (!needsZip) {
      if (multiLocale) {
        const { html, fileName } = await this.buildMultilingualHtmlDocument(
          userId,
          bidId,
          projectId,
          locales,
        );
        const pdf = await this.htmlToPdf.render(html);
        return {
          buffer: pdf,
          fileName,
          contentType: 'application/pdf',
        };
      }

      if (locales[0] === 'en') {
        const edited = await this.tryRenderEditedEnglishPdf(
          userId,
          bidId,
          projectId,
        );
        if (edited) {
          return edited;
        }
      }

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

    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException(
        'File storage is not configured. Cannot bundle attachments.',
      );
    }

    const bid = await this.loadAndAuthorizeBid(userId, bidId, projectId);
    const usedNames = new Set<string>();
    const entries: ZipEntry[] = [];

    if (multiLocale) {
      const { html, fileName } = await this.buildMultilingualHtmlDocument(
        userId,
        bidId,
        projectId,
        locales,
      );
      const pdf = await this.htmlToPdf.render(html);
      entries.push({
        name: uniqueZipName(fileName, usedNames),
        buffer: pdf,
      });
    } else if (locales[0] === 'en') {
      const edited = await this.tryRenderEditedEnglishPdf(
        userId,
        bidId,
        projectId,
      );
      if (edited) {
        entries.push({
          name: uniqueZipName(edited.fileName, usedNames),
          buffer: edited.buffer,
        });
      } else {
        const { pdf, fileName } = await this.renderPdf(
          userId,
          bidId,
          projectId,
          locales[0],
        );
        entries.push({
          name: uniqueZipName(fileName, usedNames),
          buffer: pdf,
        });
      }
    } else {
      const { pdf, fileName } = await this.renderPdf(
        userId,
        bidId,
        projectId,
        locales[0],
      );
      entries.push({
        name: uniqueZipName(fileName, usedNames),
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

  private async tryRenderEditedEnglishPdf(
    userId: string,
    bidId: string,
    projectId?: string,
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string } | null> {
    const bid = await this.loadAndAuthorizeBid(userId, bidId, projectId);
    const contract = await this.prisma.contract.findUnique({
      where: { bidId: bid.id },
      select: { englishBodyHtml: true },
    });
    const rawBody = contract?.englishBodyHtml?.trim();
    if (!rawBody) {
      return null;
    }

    const title = bid.tender.project.title;
    const data = await this.buildProposalDataForLocale(bid, 'en');
    const body = `${stripContractSignaturesBlock(rawBody)}\n${englishContractClosingHtml(data)}`;
    const html = wrapEnglishContractBodyForPdf(body, title);
    const pdf = await this.htmlToPdf.render(html);
    const slug = slugifyProjectTitle(title, bidId.slice(0, 8));
    return {
      buffer: pdf,
      fileName: `contract-draft-${slug}.pdf`,
      contentType: 'application/pdf',
    };
  }

  async generateEnglishBodyHtml(bidId: string): Promise<string> {
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
    if (bid.amount == null) {
      throw new BadRequestException('Bid has no contract amount');
    }

    const data = await this.buildProposalDataForLocale(bid, 'en');
    const fullHtml = renderCommercialProposalHtml(data);
    return stripContractSignaturesBlock(extractBodyInnerHtml(fullHtml));
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

  private async buildProposalDataForLocale(
    bid: LoadedBid,
    targetLocale: SupportedLocale,
  ): Promise<CommercialProposalRenderData> {
    const terms = (bid.termsJson as BidTermsV1 | null) ?? null;
    const project = bid.tender.project;
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
        bid.id,
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
      where: { bidId: bid.id },
      select: {
        clientSignedAt: true,
        contractorSignedAt: true,
        clientSignatureDataUrl: true,
        contractorSignatureDataUrl: true,
      },
    });

    return buildCommercialProposalData({
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
  }

  private async buildHtmlDocument(
    userId: string,
    bidId: string,
    projectId?: string,
    viewerLocale?: SupportedLocale,
  ): Promise<{ html: string; fileName: string }> {
    const bid = await this.loadAndAuthorizeBid(userId, bidId, projectId);
    const project = bid.tender.project;
    const targetLocale = viewerLocale ?? normalizeSourceLocale(project.sourceLocale);
    const data = await this.buildProposalDataForLocale(bid, targetLocale);
    const html = renderCommercialProposalHtml(data);
    const slug = slugifyProjectTitle(
      data.projectTitle || project.title,
      bidId.slice(0, 8),
    );
    const fileName = `contract-draft-${slug}.pdf`;

    return { html, fileName };
  }

  private async buildMultilingualHtmlDocument(
    userId: string,
    bidId: string,
    projectId: string | undefined,
    locales: SupportedLocale[],
  ): Promise<{ html: string; fileName: string }> {
    const bid = await this.loadAndAuthorizeBid(userId, bidId, projectId);
    const ordered = sortCommercialProposalLocales(locales);
    const dataByLocale = {} as Record<SupportedLocale, CommercialProposalRenderData>;

    for (const locale of ordered) {
      dataByLocale[locale] = await this.buildProposalDataForLocale(bid, locale);
    }

    const contract = ordered.includes('en')
      ? await this.prisma.contract.findUnique({
          where: { bidId: bid.id },
          select: { englishBodyHtml: true },
        })
      : null;
    const editedEnglishBodyHtml = contract?.englishBodyHtml?.trim() || null;

    const primary = ordered[0];
    const html = renderMultilingualCommercialProposalHtml(
      dataByLocale,
      ordered,
      { editedEnglishBodyHtml },
    );
    const slug = slugifyProjectTitle(
      dataByLocale[primary].projectTitle || bid.tender.project.title,
      bidId.slice(0, 8),
    );
    const fileName = `contract-draft-${slug}-multilang.pdf`;

    return { html, fileName };
  }
}
