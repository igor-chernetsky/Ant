import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Bid, BidStatus, Prisma } from '@prisma/client';
import { ProjectBriefV1 } from '../projects/project-brief';
import { BidAnalysisFallbackService } from '../ai/bid-analysis-fallback.service';
import {
  BidAnalysisBidInput,
  BidAnalysisResponse,
  BidAnalysisResult,
  StoredBidAnalysis,
} from '../ai/bid-analysis.types';
import { OpenAiBidAnalysisService } from '../ai/openai-bid-analysis.service';
import { PrismaService } from '../prisma/prisma.service';
import { BidTermsV1 } from './tendering.types';

type BidForFingerprint = Pick<
  Bid,
  'id' | 'status' | 'amount' | 'durationDays' | 'termsJson' | 'updatedAt'
>;

@Injectable()
export class BidAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAi: OpenAiBidAnalysisService,
    private readonly fallback: BidAnalysisFallbackService,
  ) {}

  computeBidsFingerprint(bids: BidForFingerprint[]): string {
    const payload = bids
      .filter((bid) => bid.status !== BidStatus.withdrawn)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((bid) => ({
        id: bid.id,
        status: bid.status,
        amount: bid.amount?.toString() ?? null,
        durationDays: bid.durationDays,
        terms: bid.termsJson,
        updatedAt: bid.updatedAt.toISOString(),
      }));

    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private mapBidInput(
    bid: BidForFingerprint & {
      contractor?: { companyName: string | null };
      submittedAt: Date | null;
    },
  ): BidAnalysisBidInput {
    return {
      id: bid.id,
      companyName: bid.contractor?.companyName ?? null,
      amount: bid.amount?.toString() ?? '0',
      durationDays: bid.durationDays,
      terms: (bid.termsJson as BidTermsV1 | null) ?? null,
      status: bid.status,
      submittedAt: (bid.submittedAt ?? bid.updatedAt).toISOString(),
    };
  }

  private parseStoredAnalysis(raw: unknown): StoredBidAnalysis | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const value = raw as StoredBidAnalysis;
    if (!value.fingerprint || !value.generatedAt || !value.result) {
      return null;
    }
    return value;
  }

  buildAnalysisResponse(
    bids: BidForFingerprint[],
    storedRaw: unknown,
  ): BidAnalysisResponse {
    const fingerprint = this.computeBidsFingerprint(bids);
    const submittedBidCount = bids.filter(
      (bid) => bid.status === BidStatus.submitted,
    ).length;
    const stored = this.parseStoredAnalysis(storedRaw);
    const analysisUpToDate = Boolean(
      stored && stored.fingerprint === fingerprint && stored.result,
    );

    return {
      analysis: analysisUpToDate ? stored!.result : null,
      fingerprint,
      generatedAt: analysisUpToDate ? stored!.generatedAt : null,
      canAnalyze: submittedBidCount >= 2 && !analysisUpToDate,
      analysisUpToDate,
      submittedBidCount,
    };
  }

  async getAnalysis(
    clientId: string,
    projectId: string,
  ): Promise<BidAnalysisResponse> {
    const tender = await this.loadOwnedTender(clientId, projectId);
    const bids = await this.prisma.bid.findMany({
      where: { tenderId: tender.id },
      select: {
        id: true,
        status: true,
        amount: true,
        durationDays: true,
        termsJson: true,
        updatedAt: true,
      },
    });

    return this.buildAnalysisResponse(bids, tender.bidAnalysisJson);
  }

  async analyzeBids(
    clientId: string,
    projectId: string,
  ): Promise<BidAnalysisResponse> {
    const tender = await this.loadOwnedTender(clientId, projectId);

    const bids = await this.prisma.bid.findMany({
      where: { tenderId: tender.id },
      include: { contractor: true },
      orderBy: { submittedAt: 'asc' },
    });

    const submitted = bids.filter((bid) => bid.status === BidStatus.submitted);
    if (submitted.length < 2) {
      throw new BadRequestException(
        'At least two submitted bids are required for analysis',
      );
    }

    const fingerprint = this.computeBidsFingerprint(bids);
    const stored = this.parseStoredAnalysis(tender.bidAnalysisJson);
    if (stored?.fingerprint === fingerprint) {
      throw new BadRequestException(
        'Bid analysis is already up to date for the current applications',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        estimates: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const brief = (project.briefJson ?? {}) as unknown as ProjectBriefV1;
    const totals = project.estimates[0]?.totalsJson as
      | { midAmount?: number }
      | undefined;

    const context = {
      projectTitle: project.title,
      projectDescription: project.description,
      briefSummary: brief.summary,
      ballparkMid: totals?.midAmount ?? null,
      bids: submitted.map((bid) => this.mapBidInput(bid)),
    };

    let result: BidAnalysisResult | null = null;
    if (this.openAi.isConfigured()) {
      result = await this.openAi.analyzeBids(context);
    }
    if (!result) {
      result = this.fallback.analyzeBids(context);
    }

    const generatedAt = new Date().toISOString();
    const storedAnalysis: StoredBidAnalysis = {
      fingerprint,
      generatedAt,
      result,
    };

    await this.prisma.tender.update({
      where: { id: tender.id },
      data: {
        bidAnalysisJson: storedAnalysis as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      analysis: result,
      fingerprint,
      generatedAt,
      canAnalyze: false,
      analysisUpToDate: true,
      submittedBidCount: submitted.length,
    };
  }

  private async loadOwnedTender(clientId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
    });
    if (!tender) {
      throw new NotFoundException('Tender not found');
    }

    return tender;
  }
}
