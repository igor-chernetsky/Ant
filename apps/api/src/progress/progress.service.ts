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
import { DocumentsService } from '../documents/documents.service';
import { ContractorProfilesService } from '../tendering/contractor-profiles.service';
import type { BidTermsV1 } from '../tendering/tendering.types';
import { computeProgressClaim, roundMoney } from './progress-claim.util';
import type {
  PaymentSlipCompleteDto,
  PaymentSlipPresignDto,
  ProgressClaimDto,
  ProgressOverviewDto,
  ProgressPaymentSlipDto,
  RejectProgressClaimDto,
  UpdateProgressClaimDto,
} from './progress.types';

function dec(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

function resolveAdvancePayment(
  bid: { amount: Prisma.Decimal | null },
  terms: BidTermsV1,
  contractGrandTotal: number,
): { percent: number; amount: number } {
  const ct = terms.contractTerms;
  const contractAmount =
    contractGrandTotal > 0 ? contractGrandTotal : Number(bid.amount) || 0;
  if (ct?.advancePaymentAmount != null && ct.advancePaymentAmount > 0) {
    return {
      amount: roundMoney(ct.advancePaymentAmount),
      percent:
        contractAmount > 0
          ? (ct.advancePaymentAmount / contractAmount) * 100
          : 0,
    };
  }
  const percent = ct?.advancePaymentPercent ?? 0;
  return {
    percent,
    amount: percent > 0 ? roundMoney((contractAmount * percent) / 100) : 0,
  };
}

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly notifications: NotificationsService,
    private readonly documents: DocumentsService,
  ) {}

  async getOverview(
    userId: string,
    projectId: string,
  ): Promise<ProgressOverviewDto> {
    const ctx = await this.loadContext(userId, projectId);
    const claims = await this.prisma.progressClaim.findMany({
      where: { projectId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        paymentSlipDocument: true,
      },
      orderBy: { sequenceNumber: 'desc' },
    });

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { advancePaymentSlipDocument: true },
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
      retentionPercent: ctx.retentionPercent,
      retentionLimitPercent: ctx.retentionLimitPercent,
      retentionHeldToDate: ctx.retentionHeldToDate,
      advancePaymentPercent: ctx.advancePaymentPercent,
      advancePaymentAmount: ctx.advancePaymentAmount,
      advancePaymentSlip: this.toPaymentSlipDto(
        project?.advancePaymentSlipDocument ?? null,
      ),
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
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        paymentSlipDocument: true,
      },
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
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        paymentSlipDocument: true,
      },
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
      {
        retentionPercent: ctx.retentionPercent,
        retentionLimitPercent: ctx.retentionLimitPercent,
        contractGrandTotal: ctx.contractGrandTotal,
        retentionHeldToDate: ctx.retentionHeldToDate,
      },
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
        retentionPercent: computed.totals.retentionPercent,
        retentionPeriod: computed.totals.retentionPeriod,
        payablePeriod: computed.totals.payablePeriod,
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
      include: { lines: { orderBy: { sortOrder: 'asc' } }, paymentSlipDocument: true },
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
      {
        retentionPercent: ctx.retentionPercent,
        retentionLimitPercent: ctx.retentionLimitPercent,
        contractGrandTotal: ctx.contractGrandTotal,
        retentionHeldToDate: ctx.retentionHeldToDate,
      },
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
          retentionPercent: computed.totals.retentionPercent,
          retentionPeriod: computed.totals.retentionPeriod,
          payablePeriod: computed.totals.payablePeriod,
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
      include: { lines: { orderBy: { sortOrder: 'asc' } }, paymentSlipDocument: true },
    });

    void this.notifications.dispatch(
      this.notifications.notifyClientProgressClaimSubmitted({
        clientUserId: ctx.project.clientId,
        projectId,
        projectTitle: ctx.project.title,
        companyName: ctx.companyName,
        amount: dec(updated.payablePeriod),
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
      include: { lines: { orderBy: { sortOrder: 'asc' } }, paymentSlipDocument: true },
    });

    void this.notifications.dispatch(
      this.notifications.notifyContractorProgressClaimApproved({
        contractorUserId: ctx.bid.contractor.userId,
        projectId,
        projectTitle: ctx.project.title,
        amount: dec(updated.payablePeriod),
        sequenceNumber: updated.sequenceNumber,
      }),
    );

    return this.toClaimDto(updated);
  }

  async presignClaimPaymentSlip(
    userId: string,
    projectId: string,
    claimId: string,
    dto: PaymentSlipPresignDto,
  ) {
    const ctx = await this.loadContext(userId, projectId);
    this.assertClient(ctx);
    const claim = await this.requireClaim(projectId, claimId);
    if (claim.status !== ProgressClaimStatus.approved) {
      throw new BadRequestException(
        'Payment slip can be attached only after the claim is approved',
      );
    }
    return this.documents.presignUpload(projectId, userId, {
      fileName: dto.fileName,
      contentType: dto.contentType,
      sizeBytes: dto.sizeBytes,
      category: 'payment_slip',
    });
  }

  async completeClaimPaymentSlip(
    userId: string,
    projectId: string,
    claimId: string,
    dto: PaymentSlipCompleteDto,
  ): Promise<ProgressClaimDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertClient(ctx);
    const claim = await this.requireClaim(projectId, claimId);
    if (claim.status !== ProgressClaimStatus.approved) {
      throw new BadRequestException(
        'Payment slip can be attached only after the claim is approved',
      );
    }

    const doc = await this.documents.completeUpload(
      projectId,
      dto.documentId,
      userId,
    );

    const updated = await this.prisma.progressClaim.update({
      where: { id: claimId },
      data: {
        paymentSlipDocumentId: doc.id,
        paymentSlipUploadedAt: new Date(),
      },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        paymentSlipDocument: true,
      },
    });

    return this.toClaimDto(updated);
  }

  async presignAdvancePaymentSlip(
    userId: string,
    projectId: string,
    dto: PaymentSlipPresignDto,
  ) {
    const ctx = await this.loadContext(userId, projectId);
    this.assertClient(ctx);
    if (ctx.advancePaymentAmount <= 0 && ctx.advancePaymentPercent <= 0) {
      throw new BadRequestException('This contract has no advance payment');
    }
    return this.documents.presignUpload(projectId, userId, {
      fileName: dto.fileName,
      contentType: dto.contentType,
      sizeBytes: dto.sizeBytes,
      category: 'payment_slip',
    });
  }

  async completeAdvancePaymentSlip(
    userId: string,
    projectId: string,
    dto: PaymentSlipCompleteDto,
  ): Promise<ProgressOverviewDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertClient(ctx);
    if (ctx.advancePaymentAmount <= 0 && ctx.advancePaymentPercent <= 0) {
      throw new BadRequestException('This contract has no advance payment');
    }

    const doc = await this.documents.completeUpload(
      projectId,
      dto.documentId,
      userId,
    );

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        advancePaymentSlipDocumentId: doc.id,
        advancePaymentSlipUploadedAt: new Date(),
      },
    });

    return this.getOverview(userId, projectId);
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
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        paymentSlipDocument: true,
      },
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
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        paymentSlipDocument: true,
      },
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
    const retentionPercent = terms.contractTerms?.retentionPercent ?? 10;
    const retentionLimitPercent =
      terms.contractTerms?.retentionLimitPercent ?? 10;

    const lastApproved = await this.prisma.progressClaim.findFirst({
      where: { projectId, status: ProgressClaimStatus.approved },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        paymentSlipDocument: true,
      },
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
      {
        retentionPercent,
        retentionLimitPercent,
        contractGrandTotal:
          Number(bid.amount) > 0
            ? Number(bid.amount)
            : 0,
        retentionHeldToDate: 0,
      },
    );

    const contractGrandTotal =
      Number(bid.amount) > 0
        ? Number(bid.amount)
        : contractTotals.totals.grandCumulative || worksTotal;

    const approvedClaims = await this.prisma.progressClaim.findMany({
      where: { projectId, status: ProgressClaimStatus.approved },
      select: { retentionPeriod: true },
    });
    const retentionHeldToDate = approvedClaims.reduce(
      (sum, claim) => sum + dec(claim.retentionPeriod),
      0,
    );

    const advance = resolveAdvancePayment(bid, terms, contractGrandTotal);

    return {
      project,
      bid,
      role,
      companyName: bid.contractor.companyName ?? 'Contractor',
      adjustments,
      baselineLines,
      contractGrandTotal,
      retentionPercent,
      retentionLimitPercent,
      retentionHeldToDate,
      advancePaymentPercent: advance.percent,
      advancePaymentAmount: advance.amount,
    };
  }

  private toPaymentSlipDto(
    doc: { id: string; originalName: string; uploadedAt: Date | null } | null,
  ): ProgressPaymentSlipDto | null {
    if (!doc?.uploadedAt) return null;
    return {
      documentId: doc.id,
      originalName: doc.originalName,
      uploadedAt: doc.uploadedAt.toISOString(),
    };
  }

  private toClaimDto(
    claim: Prisma.ProgressClaimGetPayload<{
      include: { lines: true; paymentSlipDocument: true };
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
      retentionPercent: claim.retentionPercent,
      retentionPeriod: dec(claim.retentionPeriod),
      payablePeriod: dec(claim.payablePeriod),
      paymentSlip: this.toPaymentSlipDto(claim.paymentSlipDocument ?? null),
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
