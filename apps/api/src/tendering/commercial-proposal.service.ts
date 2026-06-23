import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BidStatus, DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HtmlToPdfService } from '../pdf/html-to-pdf.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import {
  buildCommercialProposalData,
  renderCommercialProposalHtml,
} from './commercial-proposal.template';
import { BidTermsV1 } from './tendering.types';

const DOWNLOADABLE_BID_STATUSES: BidStatus[] = [
  BidStatus.submitted,
  BidStatus.selected,
  BidStatus.rejected,
];

@Injectable()
export class CommercialProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly htmlToPdf: HtmlToPdfService,
  ) {}

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

  private async buildHtmlDocument(
    userId: string,
    bidId: string,
    projectId?: string,
  ): Promise<{ html: string; fileName: string }> {
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

    if (!DOWNLOADABLE_BID_STATUSES.includes(bid.status)) {
      throw new BadRequestException(
        'Commercial proposal document is available after the bid is submitted',
      );
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

    const terms = (bid.termsJson as BidTermsV1 | null) ?? null;
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
      bidAmount: Number(bid.amount),
      durationDays: bid.durationDays,
      terms,
      projectDocuments: projectDocuments.map((doc) => ({
        originalName: doc.originalName,
        category: doc.category,
      })),
      employerName:
        terms?.contractTerms?.employerName?.trim() ||
        bid.tender.project.client.displayName ||
        bid.tender.project.client.email ||
        'Employer',
      employerEmail: bid.tender.project.client.email,
      contractorCompanyName: bid.contractor.companyName ?? 'Contractor',
      submittedAt: bid.submittedAt?.toISOString() ?? null,
    });

    const html = renderCommercialProposalHtml(data);
    const slug = bid.tender.project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const fileName = `commercial-proposal-${slug || bidId.slice(0, 8)}.pdf`;

    return { html, fileName };
  }
}
