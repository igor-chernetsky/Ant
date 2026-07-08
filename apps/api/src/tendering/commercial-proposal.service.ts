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
import { ContractorProfilesService } from './contractor-profiles.service';
import {
  buildCommercialProposalData,
  renderCommercialProposalHtml,
} from './commercial-proposal.template';
import { BidTermsV1, BidContractTerms } from './tendering.types';
import { normalizeContractTerms } from './commercial-proposal.template';

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
  ): Promise<{ pdf: Buffer; fileName: string }> {
    const { html, fileName } = await this.buildHtmlDocument(
      userId,
      bidId,
      projectId,
    );
    const pdf = await this.htmlToPdf.render(html);
    return { pdf, fileName };
  }

  async renderZip(
    userId: string,
    bidId: string,
    projectId?: string,
  ): Promise<{ zip: Buffer; fileName: string }> {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException(
        'File storage is not configured. Cannot bundle attachments.',
      );
    }

    const bid = await this.loadAndAuthorizeBid(userId, bidId, projectId);
    const { pdf, fileName: pdfFileName } = await this.renderPdf(
      userId,
      bidId,
      projectId,
    );

    const attachmentFiles = await this.collectAttachmentFiles(
      bid.tender.projectId,
    );
    const usedNames = new Set<string>();
    const entries: ZipEntry[] = [
      {
        name: uniqueZipName(pdfFileName, usedNames),
        buffer: pdf,
      },
    ];

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

    const zip = await buildZipBuffer(entries);
    const slug = slugifyProjectTitle(bid.tender.project.title, bidId.slice(0, 8));
    return {
      zip,
      fileName: `contract-draft-${slug}-with-attachments.zip`,
    };
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
  ): Promise<{ html: string; fileName: string }> {
    const bid = await this.loadAndAuthorizeBid(userId, bidId, projectId);

    const terms = (bid.termsJson as BidTermsV1 | null) ?? null;
    const project = bid.tender.project;
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
    const projectDocuments = await this.prisma.document.findMany({
      where: {
        projectId: bid.tender.projectId,
        status: DocumentStatus.uploaded,
      },
      orderBy: { createdAt: 'asc' },
      select: { originalName: true, category: true },
    });

    const data = buildCommercialProposalData({
      projectTitle: bid.tender.project.title,
      projectDistrict: bid.tender.project.district,
      projectDescription: bid.tender.project.description,
      clarificationSummary: bid.tender.project.clarificationSummary,
      bidAmount: Number(bid.amount),
      durationDays: bid.durationDays,
      terms: mergedTerms,
      projectDocuments: projectDocuments.map((doc) => ({
        originalName: doc.originalName,
        category: doc.category,
      })),
      employerName:
        mergedTerms?.contractTerms?.employerName?.trim() ||
        project.client.displayName ||
        bid.tender.project.client.email ||
        'Employer',
      employerEmail: project.client.email,
      contractorCompanyName: bid.contractor.companyName ?? 'Contractor',
      submittedAt: bid.submittedAt?.toISOString() ?? null,
    });

    const html = renderCommercialProposalHtml(data);
    const slug = slugifyProjectTitle(bid.tender.project.title, bidId.slice(0, 8));
    const fileName = `contract-draft-${slug}.pdf`;

    return { html, fileName };
  }
}
