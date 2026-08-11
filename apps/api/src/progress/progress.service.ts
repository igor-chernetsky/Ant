import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BidStatus,
  Prisma,
  ProgressClaimStatus,
  ProjectStatus,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContractorProfilesService } from '../tendering/contractor-profiles.service';
import type { BidTermsV1 } from '../tendering/tendering.types';
import { computeProgressClaim } from './progress-claim.util';
import type {
  ProgressClaimDto,
  ProgressOverviewDto,
  RejectProgressClaimDto,
  UpdateProgressClaimDto,
} from './progress.types';

function dec(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly notifications: NotificationsService,
  ) {}

  async getOverview(
    userId: string,
    projectId: string,
  ): Promise<ProgressOverviewDto> {
    const ctx = await this.loadContext(userId, projectId);
    const claims = await this.prisma.progressClaim.findMany({
      where: { projectId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sequenceNumber: 'desc' },
    });

    const mapped = claims.map((claim) => this.toClaimDto(claim));
    const openClaim =
      mapped.find(
        (claim) => claim.status === 'draft' || claim.status === 'submitted',
      ) ?? null;
    const lastApproved = claims.find(
      (claim) => claim.status === ProgressClaimStatus.approved,
    );
    const approvedGrandCumulative = lastApproved
      ? dec(lastApproved.grandCumulative)
      : 0;

    return {
      projectId,
      bidId: ctx.bid.id,
      editable: ctx.role === 'contractor' && ctx.project.status === 'active',
      role: ctx.role,
      contractGrandTotal: ctx.contractGrandTotal,
      approvedGrandCumulative,
      remainingGrand: Math.max(
        0,
        ctx.contractGrandTotal - approvedGrandCumulative,
      ),
      preliminaryPercent: ctx.adjustments.preliminaryPercent,
      overheadProfitPercent: ctx.adjustments.overheadProfitPercent,
      vatPercent: ctx.adjustments.vatPercent,
      baselineLines: ctx.baselineLines.map((line) => ({
        trade: line.trade,
        description: line.description ?? null,
        contractAmount: line.contractAmount,
        approvedPercent: line.approvedPercent,
        approvedAmount: line.approvedAmount,
      })),
      openClaim,
      claims: mapped,
    };
  }

  async createOrGetDraft(
    userId: string,
    projectId: string,
  ): Promise<ProgressClaimDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertContractor(ctx);
    this.assertActive(ctx.project.status);

    const existing = await this.prisma.progressClaim.findFirst({
      where: {
        projectId,
        status: {
          in: [ProgressClaimStatus.draft, ProgressClaimStatus.submitted],
        },
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (existing) {
      if (existing.status === ProgressClaimStatus.submitted) {
        throw new BadRequestException(
          'A progress claim is already awaiting client approval',
        );
      }
      return this.toClaimDto(existing);
    }

    const lastApproved = await this.prisma.progressClaim.findFirst({
      where: { projectId, status: ProgressClaimStatus.approved },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sequenceNumber: 'desc' },
    });
    const previousGrand = lastApproved ? dec(lastApproved.grandCumulative) : 0;
    const lastSeq = await this.prisma.progressClaim.findFirst({
      where: { projectId },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });

    const lineInputs = ctx.baselineLines.map((line) => ({
      trade: line.trade,
      description: line.description,
      contractAmount: line.contractAmount,
      percentComplete: line.approvedPercent,
      amountPreviouslyApproved: line.approvedAmount,
    }));
    const computed = computeProgressClaim(
      lineInputs,
      ctx.adjustments,
      previousGrand,
    );

    const created = await this.prisma.progressClaim.create({
      data: {
        projectId,
        bidId: ctx.bid.id,
        sequenceNumber: (lastSeq?.sequenceNumber ?? 0) + 1,
        status: ProgressClaimStatus.draft,
        preliminaryPercent: ctx.adjustments.preliminaryPercent,
        overheadProfitPercent: ctx.adjustments.overheadProfitPercent,
        vatPercent: ctx.adjustments.vatPercent,
        worksCumulative: computed.totals.worksCumulative,
        preliminaryCumulative: computed.totals.preliminaryCumulative,
        overheadProfitCumulative: computed.totals.overheadProfitCumulative,
        vatCumulative: computed.totals.vatCumulative,
        grandCumulative: computed.totals.grandCumulative,
        worksPeriod: computed.totals.worksPeriod,
        preliminaryPeriod: computed.totals.preliminaryPeriod,
        overheadProfitPeriod: computed.totals.overheadProfitPeriod,
        vatPeriod: computed.totals.vatPeriod,
        grandPeriod: computed.totals.grandPeriod,
        lines: {
          create: computed.lines.map((line, index) => ({
            sortOrder: index,
            trade: line.trade,
            description: line.description ?? null,
            contractAmount: line.contractAmount,
            percentComplete: line.percentComplete,
            amountPreviouslyApproved: line.amountPreviouslyApproved,
            amountCumulative: line.amountCumulative,
            amountPeriod: line.amountPeriod,
          })),
        },
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });

    return this.toClaimDto(created);
  }

  async updateDraft(
    userId: string,
    projectId: string,
    claimId: string,
    dto: UpdateProgressClaimDto,
  ): Promise<ProgressClaimDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertContractor(ctx);
    this.assertActive(ctx.project.status);

    const claim = await this.requireClaim(projectId, claimId);
    if (claim.status !== ProgressClaimStatus.draft) {
      throw new BadRequestException('Only draft claims can be edited');
    }

    const lastApproved = await this.prisma.progressClaim.findFirst({
      where: { projectId, status: ProgressClaimStatus.approved },
      orderBy: { sequenceNumber: 'desc' },
    });
    const previousGrand = lastApproved ? dec(lastApproved.grandCumulative) : 0;

    const percentByTrade = new Map(
      (dto.lines ?? []).map((line) => [
        line.trade.trim().toLowerCase(),
        Number(line.percentComplete),
      ]),
    );

    const lineInputs = ctx.baselineLines.map((base) => {
      const key = base.trade.trim().toLowerCase();
      const percent =
        percentByTrade.has(key)
          ? Number(percentByTrade.get(key))
          : base.approvedPercent;
      if (!Number.isFinite(percent)) {
        throw new BadRequestException(`Invalid percent for ${base.trade}`);
      }
      if (percent + 1e-9 < base.approvedPercent) {
        throw new BadRequestException(
          `Percent for ${base.trade} cannot be below previously approved ${base.approvedPercent}%`,
        );
      }
      if (percent > 100) {
        throw new BadRequestException(
          `Percent for ${base.trade} cannot exceed 100%`,
        );
      }
      return {
        trade: base.trade,
        description: base.description,
        contractAmount: base.contractAmount,
        percentComplete: percent,
        amountPreviouslyApproved: base.approvedAmount,
      };
    });

    const computed = computeProgressClaim(
      lineInputs,
      ctx.adjustments,
      previousGrand,
    );

    await this.prisma.$transaction([
      this.prisma.progressClaimLine.deleteMany({ where: { claimId } }),
      this.prisma.progressClaim.update({
        where: { id: claimId },
        data: {
          note:
            dto.note === undefined
              ? undefined
              : dto.note?.trim()
                ? dto.note.trim().slice(0, 2000)
                : null,
          worksCumulative: computed.totals.worksCumulative,
          preliminaryCumulative: computed.totals.preliminaryCumulative,
          overheadProfitCumulative: computed.totals.overheadProfitCumulative,
          vatCumulative: computed.totals.vatCumulative,
          grandCumulative: computed.totals.grandCumulative,
          worksPeriod: computed.totals.worksPeriod,
          preliminaryPeriod: computed.totals.preliminaryPeriod,
          overheadProfitPeriod: computed.totals.overheadProfitPeriod,
          vatPeriod: computed.totals.vatPeriod,
          grandPeriod: computed.totals.grandPeriod,
          lines: {
            create: computed.lines.map((line, index) => ({
              sortOrder: index,
              trade: line.trade,
              description: line.description ?? null,
              contractAmount: line.contractAmount,
              percentComplete: line.percentComplete,
              amountPreviouslyApproved: line.amountPreviouslyApproved,
              amountCumulative: line.amountCumulative,
              amountPeriod: line.amountPeriod,
            })),
          },
        },
      }),
    ]);

    const updated = await this.requireClaim(projectId, claimId);
    return this.toClaimDto(updated);
  }

  async submit(
    userId: string,
    projectId: string,
    claimId: string,
  ): Promise<ProgressClaimDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertContractor(ctx);
    this.assertActive(ctx.project.status);

    const claim = await this.requireClaim(projectId, claimId);
    if (claim.status !== ProgressClaimStatus.draft) {
      throw new BadRequestException('Only draft claims can be submitted');
    }
    if (dec(claim.grandPeriod) <= 0) {
      throw new BadRequestException(
        'Increase progress above the previously approved amounts before submitting',
      );
    }

    const updated = await this.prisma.progressClaim.update({
      where: { id: claimId },
      data: {
        status: ProgressClaimStatus.submitted,
        submittedAt: new Date(),
        submittedById: userId,
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });

    void this.notifications.dispatch(
      this.notifications.notifyClientProgressClaimSubmitted({
        clientUserId: ctx.project.clientId,
        projectId,
        projectTitle: ctx.project.title,
        companyName: ctx.companyName,
        amount: dec(updated.grandPeriod),
        sequenceNumber: updated.sequenceNumber,
      }),
    );

    return this.toClaimDto(updated);
  }

  async approve(
    userId: string,
    projectId: string,
    claimId: string,
  ): Promise<ProgressClaimDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertClient(ctx);

    const claim = await this.requireClaim(projectId, claimId);
    if (claim.status !== ProgressClaimStatus.submitted) {
      throw new BadRequestException('Only submitted claims can be approved');
    }

    const updated = await this.prisma.progressClaim.update({
      where: { id: claimId },
      data: {
        status: ProgressClaimStatus.approved,
        reviewedAt: new Date(),
        reviewedById: userId,
        rejectionReason: null,
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });

    void this.notifications.dispatch(
      this.notifications.notifyContractorProgressClaimApproved({
        contractorUserId: ctx.bid.contractor.userId,
        projectId,
        projectTitle: ctx.project.title,
        amount: dec(updated.grandPeriod),
        sequenceNumber: updated.sequenceNumber,
      }),
    );

    return this.toClaimDto(updated);
  }

  async reject(
    userId: string,
    projectId: string,
    claimId: string,
    dto: RejectProgressClaimDto,
  ): Promise<ProgressClaimDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertClient(ctx);

    const claim = await this.requireClaim(projectId, claimId);
    if (claim.status !== ProgressClaimStatus.submitted) {
      throw new BadRequestException('Only submitted claims can be rejected');
    }

    const updated = await this.prisma.progressClaim.update({
      where: { id: claimId },
      data: {
        status: ProgressClaimStatus.rejected,
        reviewedAt: new Date(),
        reviewedById: userId,
        rejectionReason: dto.reason?.trim()
          ? dto.reason.trim().slice(0, 2000)
          : null,
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });

    void this.notifications.dispatch(
      this.notifications.notifyContractorProgressClaimRejected({
        contractorUserId: ctx.bid.contractor.userId,
        projectId,
        projectTitle: ctx.project.title,
        sequenceNumber: updated.sequenceNumber,
        reason: updated.rejectionReason,
      }),
    );

    return this.toClaimDto(updated);
  }

  private assertClient(ctx: { role: 'client' | 'contractor' | null }) {
    if (ctx.role !== 'client') {
      throw new ForbiddenException('Only the project owner can do this');
    }
  }

  private assertContractor(ctx: { role: 'client' | 'contractor' | null }) {
    if (ctx.role !== 'contractor') {
      throw new ForbiddenException('Only the awarded contractor can do this');
    }
  }

  private assertActive(status: ProjectStatus) {
    if (status !== ProjectStatus.active) {
      throw new BadRequestException(
        'Progress claims are available after the contract is fully signed and the project is active',
      );
    }
  }

  private async requireClaim(projectId: string, claimId: string) {
    const claim = await this.prisma.progressClaim.findFirst({
      where: { id: claimId, projectId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!claim) {
      throw new NotFoundException('Progress claim not found');
    }
    return claim;
  }

  private async loadContext(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tender: {
          include: {
            awardedBid: {
              include: {
                contractor: { select: { id: true, userId: true, companyName: true } },
              },
            },
          },
        },
        contract: { select: { status: true, bidId: true } },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const bid = project.tender?.awardedBid;
    if (!bid || bid.status !== BidStatus.selected) {
      throw new BadRequestException('No awarded contractor bid on this project');
    }

    let role: 'client' | 'contractor' | null = null;
    if (project.clientId === userId) {
      role = 'client';
    } else {
      const profile = await this.contractorProfiles.getByUserId(userId);
      if (profile && profile.id === bid.contractorId) {
        role = 'contractor';
      }
    }
    if (!role) {
      throw new ForbiddenException('Access denied');
    }

    const terms = (bid.termsJson ?? {}) as BidTermsV1;
    const adjustments = {
      preliminaryPercent: terms.costAdjustments?.preliminaryPercent ?? 0,
      overheadProfitPercent: terms.costAdjustments?.overheadProfitPercent ?? 0,
      vatPercent: terms.costAdjustments?.vatPercent ?? 0,
    };

    const lastApproved = await this.prisma.progressClaim.findFirst({
      where: { projectId, status: ProgressClaimStatus.approved },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sequenceNumber: 'desc' },
    });

    const approvedByTrade = new Map(
      (lastApproved?.lines ?? []).map((line) => [
        line.trade.trim().toLowerCase(),
        {
          percent: dec(line.percentComplete),
          amount: dec(line.amountCumulative),
        },
      ]),
    );

    const lineItems = terms.lineItems?.filter(
      (item) => item.trade?.trim() && Number(item.amount) > 0,
    );
    const baselineLines =
      lineItems && lineItems.length > 0
        ? lineItems.map((item) => {
            const key = item.trade.trim().toLowerCase();
            const approved = approvedByTrade.get(key);
            return {
              trade: item.trade.trim(),
              description: item.description?.trim() || undefined,
              contractAmount: Math.round(Number(item.amount)),
              approvedPercent: approved?.percent ?? 0,
              approvedAmount: approved?.amount ?? 0,
            };
          })
        : [
            {
              trade: 'works',
              description: 'Contract works',
              contractAmount: Math.round(
                Number(
                  terms.costAdjustments?.worksSubtotal ??
                    bid.amount ??
                    0,
                ),
              ),
              approvedPercent:
                approvedByTrade.get('works')?.percent ?? 0,
              approvedAmount: approvedByTrade.get('works')?.amount ?? 0,
            },
          ];

    if (baselineLines.every((line) => line.contractAmount <= 0)) {
      throw new BadRequestException(
        'Awarded bid has no priced works to claim against',
      );
    }

    const worksTotal = baselineLines.reduce(
      (sum, line) => sum + line.contractAmount,
      0,
    );
    const contractTotals = computeProgressClaim(
      baselineLines.map((line) => ({
        trade: line.trade,
        description: line.description,
        contractAmount: line.contractAmount,
        percentComplete: 100,
        amountPreviouslyApproved: 0,
      })),
      adjustments,
      0,
    );

    return {
      project,
      bid,
      role,
      companyName: bid.contractor.companyName ?? 'Contractor',
      adjustments,
      baselineLines,
      contractGrandTotal:
        Number(bid.amount) > 0
          ? Number(bid.amount)
          : contractTotals.totals.grandCumulative || worksTotal,
    };
  }

  private toClaimDto(
    claim: Prisma.ProgressClaimGetPayload<{
      include: { lines: true };
    }>,
  ): ProgressClaimDto {
    return {
      id: claim.id,
      projectId: claim.projectId,
      bidId: claim.bidId,
      sequenceNumber: claim.sequenceNumber,
      status: claim.status,
      note: claim.note,
      rejectionReason: claim.rejectionReason,
      preliminaryPercent: claim.preliminaryPercent,
      overheadProfitPercent: claim.overheadProfitPercent,
      vatPercent: claim.vatPercent,
      worksCumulative: dec(claim.worksCumulative),
      preliminaryCumulative: dec(claim.preliminaryCumulative),
      overheadProfitCumulative: dec(claim.overheadProfitCumulative),
      vatCumulative: dec(claim.vatCumulative),
      grandCumulative: dec(claim.grandCumulative),
      worksPeriod: dec(claim.worksPeriod),
      preliminaryPeriod: dec(claim.preliminaryPeriod),
      overheadProfitPeriod: dec(claim.overheadProfitPeriod),
      vatPeriod: dec(claim.vatPeriod),
      grandPeriod: dec(claim.grandPeriod),
      submittedAt: claim.submittedAt?.toISOString() ?? null,
      reviewedAt: claim.reviewedAt?.toISOString() ?? null,
      createdAt: claim.createdAt.toISOString(),
      updatedAt: claim.updatedAt.toISOString(),
      lines: claim.lines
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((line) => ({
          id: line.id,
          sortOrder: line.sortOrder,
          trade: line.trade,
          description: line.description,
          contractAmount: dec(line.contractAmount),
          percentComplete: dec(line.percentComplete),
          amountPreviouslyApproved: dec(line.amountPreviouslyApproved),
          amountCumulative: dec(line.amountCumulative),
          amountPeriod: dec(line.amountPeriod),
        })),
    };
  }
}
