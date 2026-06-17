import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BidAnalysisContext,
  BidAnalysisResult,
} from './bid-analysis.types';

@Injectable()
export class OpenAiBidAnalysisService {
  private readonly logger = new Logger(OpenAiBidAnalysisService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    this.model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini').trim();
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async analyzeBids(context: BidAnalysisContext): Promise<BidAnalysisResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const bidIds = new Set(context.bids.map((bid) => bid.id));

    const system = `You are an independent construction procurement advisor helping a homeowner choose a contractor bid.
Critically compare each bid against the project scope and against each other.
Return JSON only with keys:
recommendedBidId, recommendedCompanyName, summary, reasoning, comparisons, confidence.

Rules:
- recommendedBidId must be one of the provided bid ids, or null if no bid is recommendable.
- summary: 2-4 sentences with a clear recommendation.
- reasoning: detailed argumentation (4-8 sentences) covering price, scope coverage, timeline, and risks.
- comparisons: one entry per bid with bidId, strengths[], weaknesses[], riskFlags[] (short bullet phrases).
- Do not invent facts missing from the bid data; flag gaps as risks.
- Price alone must not decide the winner if scope or risk differs materially.
- confidence: 0-1.
- Write in English.`;

    const user = JSON.stringify({
      project: {
        title: context.projectTitle,
        description: context.projectDescription,
        briefSummary: context.briefSummary,
        ballparkMid: context.ballparkMid,
      },
      bids: context.bids,
    });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.35,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`OpenAI HTTP ${response.status}: ${text.slice(0, 200)}`);
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content) as {
        recommendedBidId?: string | null;
        recommendedCompanyName?: string | null;
        summary?: string;
        reasoning?: string;
        comparisons?: Array<{
          bidId?: string;
          strengths?: string[];
          weaknesses?: string[];
          riskFlags?: string[];
        }>;
        confidence?: number;
      };

      const comparisons = (parsed.comparisons ?? [])
        .filter((item) => item.bidId && bidIds.has(item.bidId))
        .map((item) => {
          const bid = context.bids.find((b) => b.id === item.bidId);
          return {
            bidId: item.bidId!,
            companyName: bid?.companyName ?? null,
            strengths: (item.strengths ?? []).map((s) => s.trim()).filter(Boolean),
            weaknesses: (item.weaknesses ?? []).map((s) => s.trim()).filter(Boolean),
            riskFlags: (item.riskFlags ?? []).map((s) => s.trim()).filter(Boolean),
          };
        });

      const recommendedBidId =
        parsed.recommendedBidId && bidIds.has(parsed.recommendedBidId)
          ? parsed.recommendedBidId
          : null;

      const recommendedBid = recommendedBidId
        ? context.bids.find((bid) => bid.id === recommendedBidId)
        : null;

      return {
        recommendedBidId,
        recommendedCompanyName:
          parsed.recommendedCompanyName?.trim() ||
          recommendedBid?.companyName ||
          null,
        summary: parsed.summary?.trim() || 'No summary generated.',
        reasoning: parsed.reasoning?.trim() || parsed.summary?.trim() || '',
        comparisons,
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.55)),
        provider: 'openai',
      };
    } catch (err) {
      this.logger.warn(
        `OpenAI bid analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
