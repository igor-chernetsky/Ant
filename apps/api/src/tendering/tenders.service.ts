import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Bid,
  BidStatus,
  BidWithdrawalReason,
  ClarificationMode,
  ContractStatus,
  ContractorProfile,
  Prisma,
  ProjectStatus,
  Tender,
  TenderStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BidMessagesService } from './bid-messages.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import { TenderAutoCloseService } from './tender-auto-close.service';
import { TenderMatchingService } from './tender-matching.service';
import { TenderClarificationsService } from './tender-clarifications.service';
import { DefaultCostBreakdownService } from './default-cost-breakdown.service';
import { ProjectsService } from '../projects/projects.service';
import type { ProjectBriefV1 } from '../projects/project-brief';
import { inferPropertyOwnershipForm } from '../projects/discover-filters';
import {
  calendarDaysBetween,
  inferContractPeriodMonths,
  inferWorksFinishDate,
  inferWorksStartDate,
  monthsFromDurationDays,
} from './contract-terms-inference';
import {
  DEFAULT_PROPERTY_OWNERSHIP,
  DEFAULT_RETENTION_RELEASE_NOTES,
} from './contract-terms.defaults';
import { normalizeContractTerms } from './commercial-proposal.template';
import { ContractsService } from './contracts.service';
import { assertBreakdownMatchesTotal } from './bid-breakdown.util';
import {
  isApplicationsDeadlinePassed,
  resolveApplicationsCloseAt,
} from './tender-deadline';
import { ProjectLocalizationService } from '../localization/project-localization.service';
import type { SupportedLocale } from '../users/locale.types';
import {
  BID_WITHDRAWAL_REASON_CODES,
  BidResponse,
  BidTermsV1,
  BidWithdrawalReasonCode,
  DefaultCostBreakdownItem,
  MAX_BID_APPROACH_LENGTH,
  MAX_BID_LINE_ITEMS,
  MAX_BID_NOTES_LENGTH,
  MAX_BID_SCOPE_LENGTH,
  MAX_BID_SPECIAL_CONDITIONS_LENGTH,
  PublishTenderDto,
  SubmitBidDto,
  UpdateBidContractTermsDto,
  UpdateTenderDeadlineDto,
  TenderPublishPreview,
  TenderResponse,
  ContractorApplicationItem,
  BidContractTerms,
  ContractorCoveragePreview,
  WithdrawBidDto,
} from './tendering.types';

type TenderWithRelations = Tender & {
  bids: Array<
    Bid & {
      contractor: ContractorProfile;
    }
  >;
};

@Injectable()
export class TendersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: TenderMatchingService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly autoClose: TenderAutoCloseService,
    private readonly bidMessages: BidMessagesService,
    private readonly notifications: NotificationsService,
    private readonly clarifications: TenderClarificationsService,
    private readonly costBreakdown: DefaultCostBreakdownService,
    private readonly projectsService: ProjectsService,
    private readonly contracts: ContractsService,
    private readonly projectLocalization: ProjectLocalizationService,
  ) {}

  private mapBid(bid: Bid & { contractor: ContractorProfile }): BidResponse {
    return {
      id: bid.id,
      tenderId: bid.tenderId,
      contractorId: bid.contractorId,
      companyName: bid.contractor.companyName,
      status: bid.status,
      contenderNumber: bid.contenderNumber,
      enrolledAt: bid.enrolledAt?.toISOString() ?? null,
      amount: bid.amount?.toString() ?? null,
      durationDays: bid.durationDays,
      terms: (bid.termsJson as BidTermsV1 | null) ?? null,
      submittedAt: bid.submittedAt?.toISOString() ?? null,
      withdrawalReason: bid.withdrawalReason ?? null,
      withdrawalNote: bid.withdrawalNote ?? null,
      withdrawnAt: bid.withdrawnAt?.toISOString() ?? null,
    };
  }

  private async localizeBidResponse(
    projectId: string,
    bid: BidResponse,
    locale: SupportedLocale,
  ): Promise<BidResponse> {
    if (!bid.terms) {
      return bid;
    }
    return {
      ...bid,
      terms: await this.projectLocalization.localizeBidTermsForViewer(
        projectId,
        `bid.${bid.id}`,
        bid.terms,
        locale,
      ),
    };
  }

  private mapTender(
    tender: TenderWithRelations,
    projectContractTerms: BidContractTerms = {},
  ): TenderResponse {
    const bids = tender.bids
      .filter(
        (b) =>
          b.status !== BidStatus.withdrawn || b.withdrawalReason != null,
      )
      .map((b) => this.mapBid(b));

    return {
      id: tender.id,
      projectId: tender.projectId,
      status: tender.status,
      currency: tender.currency,
      minBids: tender.minBids,
      opensAt: tender.opensAt?.toISOString() ?? null,
      closesAt: tender.closesAt?.toISOString() ?? null,
      noApplicationsDeadline: tender.closesAt == null,
      applicationsDeadlinePassed: isApplicationsDeadlinePassed(tender.closesAt),
      awardedBidId: tender.awardedBidId,
      bids,
      applicationCount: bids.filter((b) => b.status !== BidStatus.withdrawn)
        .length,
      submittedBidCount: bids.filter((b) => b.status === BidStatus.submitted)
        .length,
      defaultCostBreakdown: this.costBreakdown.parseStored(
        tender.defaultCostBreakdown,
      ),
      projectContractTerms,
      createdAt: tender.createdAt.toISOString(),
      updatedAt: tender.updatedAt.toISOString(),
    };
  }

  private assertWithinApplicationsDeadline(tender: Tender): void {
    if (tender.status === TenderStatus.draft) {
      return;
    }
    if (isApplicationsDeadlinePassed(tender.closesAt)) {
      throw new BadRequestException('Application deadline has passed');
    }
  }

  async hasActiveParticipation(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    const profile = await this.contractorProfiles.getByUserId(userId);
    if (!profile) {
      return false;
    }

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      select: {
        bids: {
          where: {
            contractorId: profile.id,
            status: { not: BidStatus.withdrawn },
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    return Boolean(tender?.bids.length);
  }

  private includeTenderRelations() {
    return {
      bids: {
        include: { contractor: true },
        orderBy: { submittedAt: 'desc' as const },
      },
    };
  }

  /** Re-open tenders that were closed without any submitted proposals. */
  private async reconcileDormantTender(tenderId: string): Promise<void> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: {
        bids: {
          where: { status: BidStatus.submitted },
          select: { id: true },
        },
      },
    });
    if (!tender) {
      return;
    }

    const hasSubmittedBids = tender.bids.length > 0;

    if (tender.status === TenderStatus.closed && !hasSubmittedBids) {
      await this.prisma.tender.update({
        where: { id: tenderId },
        data: { status: TenderStatus.open },
      });
    }
  }

  private async loadTender(tenderId: string): Promise<TenderWithRelations> {
    await this.reconcileDormantTender(tenderId);
    await this.autoClose.closeTenderIfExpired(tenderId);

    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: this.includeTenderRelations(),
    });
    if (!tender) {
      throw new NotFoundException('Tender not found');
    }
    return tender;
  }

  private async assertProjectOwner(projectId: string, clientId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }
    return project;
  }

  async getForProject(
    clientId: string,
    projectId: string,
    locale: SupportedLocale = 'en',
  ): Promise<TenderResponse | null> {
    const project = await this.assertProjectOwner(projectId, clientId);

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      select: { id: true },
    });

    if (!tender) {
      if (project.status === ProjectStatus.in_tender) {
        return this.createTender(clientId, projectId);
      }
      return null;
    }

    const mapped = this.mapTender(
      await this.loadTender(tender.id),
      this.resolveProjectContractTerms(project),
    );

    mapped.bids = await Promise.all(
      mapped.bids.map((bid) =>
        this.localizeBidResponse(projectId, bid, locale),
      ),
    );

    return mapped;
  }

  private resolveProjectContractTerms(project: {
    title: string;
    description: string | null;
    district: string | null;
    scopeSummary: string | null;
    briefJson: unknown;
    tenderContractTermsJson: unknown;
  }): BidContractTerms {
    const scopeSummary =
      project.scopeSummary?.trim() ||
      project.description?.trim() ||
      `Construction works for ${project.title}`;

    const storedTerms = this.parseProjectContractTerms(
      project.tenderContractTermsJson,
    );

    const contractTerms: BidContractTerms =
      normalizeContractTerms({
        retentionPercent: 10,
        retentionLimitPercent: 10,
        defectNotificationMonths: 24,
        advancePaymentPercent: 0,
        ...storedTerms,
        siteAddress: storedTerms.siteAddress ?? project.district ?? undefined,
        subjectOfContract:
          storedTerms.subjectOfContract ?? scopeSummary ?? undefined,
        propertyOwnership:
          storedTerms.propertyOwnership?.trim() || DEFAULT_PROPERTY_OWNERSHIP,
        retentionReleaseNotes:
          storedTerms.retentionReleaseNotes?.trim() ||
          DEFAULT_RETENTION_RELEASE_NOTES,
      }) ?? {
        retentionPercent: 10,
        retentionLimitPercent: 10,
        defectNotificationMonths: 24,
        advancePaymentPercent: 0,
        propertyOwnership: DEFAULT_PROPERTY_OWNERSHIP,
        retentionReleaseNotes: DEFAULT_RETENTION_RELEASE_NOTES,
        siteAddress: project.district ?? undefined,
        subjectOfContract: scopeSummary,
      };

    const brief = (project.briefJson ?? null) as ProjectBriefV1 | null;
    const worksStartDate =
      contractTerms.worksStartDate?.trim() || inferWorksStartDate(brief);
    const contractPeriodMonths =
      contractTerms.contractPeriodMonths ??
      inferContractPeriodMonths({ brief });
    const worksFinishDate =
      contractTerms.worksFinishDate?.trim() ||
      inferWorksFinishDate({
        worksStartDate,
        contractPeriodMonths,
      });
    const periodDays = calendarDaysBetween(worksStartDate, worksFinishDate);
    return {
      ...contractTerms,
      worksStartDate,
      worksFinishDate,
      contractPeriodMonths:
        periodDays != null
          ? monthsFromDurationDays(periodDays)
          : contractPeriodMonths,
    };
  }

  async getPublishPreview(
    clientId: string,
    projectId: string,
  ): Promise<TenderPublishPreview> {
    const project = await this.assertProjectOwner(projectId, clientId);
    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
    });

    const defaultCostBreakdown =
      tender != null
        ? await this.costBreakdown.resolveForTender(
            tender.id,
            projectId,
            tender.defaultCostBreakdown,
          )
        : await this.costBreakdown.generateForProject(projectId);

    let clarificationSummary = project.clarificationSummary;
    if (
      project.clarificationMode === ClarificationMode.structured_qa &&
      tender?.status === TenderStatus.draft
    ) {
      const preview =
        await this.clarifications.previewAnsweredSummaryForProject(projectId);
      if (preview) {
        clarificationSummary = preview;
      }
    }

    const scopeSummary =
      project.scopeSummary?.trim() ||
      project.description?.trim() ||
      `Construction works for ${project.title}`;

    return {
      scopeSummary,
      clarificationSummary,
      defaultCostBreakdown,
      contractTerms: this.resolveProjectContractTerms(project),
    };
  }

  async getContractorCoverage(
    clientId: string,
    projectId: string,
  ): Promise<ContractorCoveragePreview> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tags: { include: { tag: true } },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }

    return this.matching.getContractorCoverageForProject(project, clientId);
  }

  async createTender(
    clientId: string,
    projectId: string,
    dto?: PublishTenderDto,
  ): Promise<TenderResponse> {
    const project = await this.assertProjectOwner(projectId, clientId);
    this.matching.assertProjectEligibleForTender(project);

    const existing = await this.prisma.tender.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (existing) {
      return this.mapTender(await this.loadTender(existing.id));
    }

    const now = new Date();
    const structuredClarification =
      project.clarificationMode === ClarificationMode.structured_qa;
    const closesAt = resolveApplicationsCloseAt(dto);

    const tender = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tender.create({
        data: {
          projectId,
          status: structuredClarification ? TenderStatus.draft : TenderStatus.open,
          opensAt: structuredClarification ? null : now,
          closesAt,
          ...(dto?.defaultCostBreakdown?.length
            ? {
                defaultCostBreakdown:
                  this.normalizePublishCostBreakdown(
                    dto.defaultCostBreakdown,
                  ) as unknown as Prisma.InputJsonValue,
              }
            : {}),
        },
        include: this.includeTenderRelations(),
      });

      await tx.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.in_tender,
          ...this.projectPublishPackageUpdate(dto),
        },
      });

      return created;
    });

    if (!dto?.defaultCostBreakdown?.length) {
      await this.costBreakdown.generateAndStoreForTender(tender.id, projectId);
    }

    this.notifications.dispatch(
      this.notifications.notifyMatchingContractorsForProject(projectId),
    );
    this.projectLocalization.scheduleWarmProjectTranslations(projectId);

    return this.mapTender(await this.loadTender(tender.id));
  }

  async startTender(
    clientId: string,
    projectId: string,
    dto?: PublishTenderDto,
  ): Promise<TenderResponse> {
    const project = await this.assertProjectOwner(projectId, clientId);
    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      include: this.includeTenderRelations(),
    });

    if (!tender) {
      throw new NotFoundException('Tender not found. Create a tender first.');
    }

    if (tender.status === TenderStatus.open) {
      return this.mapTender(tender);
    }

    if (tender.status !== TenderStatus.draft) {
      throw new BadRequestException(
        'Tender cannot be started in its current status',
      );
    }

    if (project.clarificationMode === ClarificationMode.structured_qa) {
      await this.clarifications.summarizeAnsweredForProject(projectId);
    }

    const now = new Date();
    const closesAt =
      dto != null
        ? resolveApplicationsCloseAt(dto)
        : tender.closesAt ?? resolveApplicationsCloseAt();

    if (isApplicationsDeadlinePassed(closesAt, now)) {
      throw new BadRequestException(
        'Application deadline is in the past. Choose a future date or extend the deadline.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tender.update({
        where: { id: tender.id },
        data: {
          status: TenderStatus.open,
          opensAt: now,
          closesAt,
          deadlineNotifiedAt: null,
          ...(dto?.defaultCostBreakdown?.length
            ? {
                defaultCostBreakdown:
                  this.normalizePublishCostBreakdown(
                    dto.defaultCostBreakdown,
                  ) as unknown as Prisma.InputJsonValue,
              }
            : {}),
        },
        include: this.includeTenderRelations(),
      });

      await tx.project.update({
        where: { id: project.id },
        data: {
          status: ProjectStatus.in_tender,
          ...this.projectPublishPackageUpdate(dto),
        },
      });

      return next;
    });

    const enrolledUserIds = await this.enrollDiscussionParticipants(
      updated.id,
      project.clarificationMode,
    );

    const existingBreakdown = this.costBreakdown.parseStored(
      updated.defaultCostBreakdown,
    );
    await this.costBreakdown.resolveForTender(
      updated.id,
      projectId,
      existingBreakdown.length > 0
        ? updated.defaultCostBreakdown
        : [],
    );

    const projectAfterOpen = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        title: true,
        district: true,
        clarificationSummary: true,
      },
    });

    if (projectAfterOpen) {
      this.notifications.dispatch(
        this.notifications.notifyContractorsTenderOpened({
          contractorUserIds: enrolledUserIds,
          projectId,
          projectTitle: projectAfterOpen.title,
          district: projectAfterOpen.district,
          clarificationSummary: projectAfterOpen.clarificationSummary,
        }),
      );
    }

    this.notifications.dispatch(
      this.notifications.notifyMatchingContractorsForProject(projectId),
    );
    this.projectLocalization.scheduleWarmProjectTranslations(projectId);

    return this.mapTender(await this.loadTender(updated.id));
  }

  async updateTenderDeadline(
    clientId: string,
    projectId: string,
    dto: UpdateTenderDeadlineDto,
  ): Promise<TenderResponse> {
    await this.assertProjectOwner(projectId, clientId);

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
    });
    if (!tender) {
      throw new NotFoundException('Tender not found');
    }

    if (tender.status === TenderStatus.awarded || tender.status === TenderStatus.cancelled) {
      throw new BadRequestException(
        'Deadline cannot be changed after the tender is awarded or cancelled',
      );
    }

    const closesAt = resolveApplicationsCloseAt(dto);
    const now = new Date();
    if (closesAt && isApplicationsDeadlinePassed(closesAt, now)) {
      throw new BadRequestException('Application deadline must be in the future');
    }

    const reopen =
      tender.status === TenderStatus.closed &&
      (!closesAt || !isApplicationsDeadlinePassed(closesAt, now));

    const updated = await this.prisma.tender.update({
      where: { id: tender.id },
      data: {
        closesAt,
        deadlineNotifiedAt: null,
        ...(reopen ? { status: TenderStatus.open } : {}),
      },
      include: this.includeTenderRelations(),
    });

    return this.mapTender(await this.loadTender(updated.id));
  }

  private async defaultCostBreakdownForTender(
    tender:
      | { id: string; projectId: string; defaultCostBreakdown: unknown }
      | null
      | undefined,
  ): Promise<DefaultCostBreakdownItem[]> {
    if (!tender) {
      return [];
    }
    return this.costBreakdown.resolveForTender(
      tender.id,
      tender.projectId,
      tender.defaultCostBreakdown,
    );
  }

  async revertTenderToEstimated(
    clientId: string,
    projectId: string,
  ): Promise<void> {
    const project = await this.assertProjectOwner(projectId, clientId);

    if (project.status !== ProjectStatus.in_tender) {
      throw new BadRequestException('Project is not published for bids');
    }

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      include: {
        bids: {
          where: { status: { not: BidStatus.withdrawn } },
          select: { id: true },
        },
      },
    });

    if (!tender) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.estimated },
      });
      return;
    }

    if (
      tender.status !== TenderStatus.open &&
      tender.status !== TenderStatus.draft
    ) {
      throw new BadRequestException(
        'Tender can only be reverted before bidding starts',
      );
    }

    if (tender.bids.length > 0) {
      throw new BadRequestException(
        'Cannot revert tender after contractors have applied',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tender.delete({ where: { id: tender.id } });
      await tx.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.estimated },
      });
    });
  }

  async selectBid(
    clientId: string,
    projectId: string,
    bidId: string,
    locale: SupportedLocale = 'en',
  ): Promise<TenderResponse> {
    await this.assertProjectOwner(projectId, clientId);

    const tenderRef = await this.prisma.tender.findUnique({
      where: { projectId },
      select: { id: true },
    });

    if (!tenderRef) {
      throw new NotFoundException('Tender not found');
    }

    const tender = await this.loadTender(tenderRef.id);

    if (
      tender.status !== TenderStatus.open &&
      tender.status !== TenderStatus.closed
    ) {
      throw new BadRequestException('Cannot select a bid for this tender status');
    }

    const bid = tender.bids.find((b) => b.id === bidId);
    if (!bid || bid.status !== BidStatus.submitted) {
      throw new NotFoundException('Bid not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.bid.updateMany({
        where: {
          tenderId: tender.id,
          id: { not: bidId },
          status: BidStatus.submitted,
        },
        data: { status: BidStatus.rejected },
      });

      await tx.bid.update({
        where: { id: bidId },
        data: { status: BidStatus.selected },
      });

      const nextTender = await tx.tender.update({
        where: { id: tender.id },
        data: {
          status: TenderStatus.awarded,
          awardedBidId: bidId,
        },
        include: this.includeTenderRelations(),
      });

      await tx.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.awarded },
      });

      await this.contracts.createForAwardedBid(tx, projectId, bidId);

      return nextTender;
    });

    await this.contracts.generateEnglishBodyAfterAward(projectId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    const selectedBid = updated.bids.find((b) => b.id === bidId);
    const rejectedBids = updated.bids.filter(
      (b) => b.id !== bidId && b.status === BidStatus.rejected,
    );

    if (project && selectedBid) {
      this.notifications.dispatch(
        this.notifications.notifyContractorBidSelected({
          contractorUserId: selectedBid.contractor.userId,
          projectId,
          projectTitle: project.title,
        }),
      );
      for (const rejected of rejectedBids) {
        this.notifications.dispatch(
          this.notifications.notifyContractorBidRejected({
            contractorUserId: rejected.contractor.userId,
            projectId,
            projectTitle: project.title,
          }),
        );
      }
    }

    const mapped = this.mapTender(
      updated,
      project ? this.resolveProjectContractTerms(project) : {},
    );
    mapped.bids = await Promise.all(
      mapped.bids.map((b) => this.localizeBidResponse(projectId, b, locale)),
    );
    return mapped;
  }

  async releaseAwardedContractor(
    clientId: string,
    projectId: string,
  ): Promise<TenderResponse> {
    await this.assertProjectOwner(projectId, clientId);
    return this.revertAwardToTender(projectId, 'client');
  }

  private async revertAwardToTender(
    projectId: string,
    initiator: 'client' | 'contractor',
  ): Promise<TenderResponse> {
    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      include: {
        bids: { include: { contractor: true } },
        project: { include: { contract: true } },
      },
    });

    if (!tender) {
      throw new NotFoundException('Tender not found');
    }

    if (tender.status !== TenderStatus.awarded || !tender.awardedBidId) {
      throw new BadRequestException('Tender is not in the awarded phase');
    }

    const contract = tender.project.contract;
    if (!contract) {
      throw new BadRequestException('No contract draft exists for this project');
    }

    if (contract.status === ContractStatus.fully_signed) {
      throw new BadRequestException(
        'Cannot reopen tender after the contract is fully signed',
      );
    }

    const awardedBid = tender.bids.find((b) => b.id === tender.awardedBidId);
    if (!awardedBid) {
      throw new NotFoundException('Awarded bid not found');
    }

    const formerSelectedUserId = awardedBid.contractor.userId;
    const companyName = awardedBid.contractor.companyName ?? 'Contractor';

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.contract.delete({ where: { id: contract.id } });

      if (initiator === 'contractor') {
        await tx.bid.update({
          where: { id: awardedBid.id },
          data: { status: BidStatus.withdrawn },
        });
      } else {
        await tx.bid.update({
          where: { id: awardedBid.id },
          data: { status: BidStatus.rejected },
        });
      }

      await tx.bid.updateMany({
        where: {
          tenderId: tender.id,
          status: BidStatus.rejected,
          id: { not: awardedBid.id },
        },
        data: { status: BidStatus.submitted },
      });

      const nextTender = await tx.tender.update({
        where: { id: tender.id },
        data: {
          status: TenderStatus.open,
          awardedBidId: null,
        },
        include: this.includeTenderRelations(),
      });

      await tx.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.in_tender },
      });

      return nextTender;
    });

    const participantUserIds = updated.bids
      .filter((bid) => {
        if (bid.status === BidStatus.withdrawn) {
          return false;
        }
        return (
          bid.status === BidStatus.submitted ||
          bid.status === BidStatus.enrolled ||
          bid.status === BidStatus.clarifying
        );
      })
      .map((bid) => bid.contractor.userId);

    this.notifications.dispatch(
      this.notifications.notifyTenderResumed({
        contractorUserIds: participantUserIds,
        projectId,
        projectTitle: tender.project.title,
        district: tender.project.district,
      }),
    );

    if (initiator === 'contractor') {
      this.notifications.dispatch(
        this.notifications.notifyClientContractorWithdrewAward({
          clientUserId: tender.project.clientId,
          projectId,
          projectTitle: tender.project.title,
          companyName,
        }),
      );
    } else {
      this.notifications.dispatch(
        this.notifications.notifyContractorAwardReleased({
          contractorUserId: formerSelectedUserId,
          projectId,
          projectTitle: tender.project.title,
        }),
      );
    }

    return this.mapTender(
      updated,
      this.resolveProjectContractTerms(tender.project),
    );
  }

  async listApplicationsForContractor(
    userId: string,
  ): Promise<ContractorApplicationItem[]> {
    const profile = await this.contractorProfiles.getByUserId(userId);
    if (!profile) {
      return [];
    }

    const bids = await this.prisma.bid.findMany({
      where: {
        contractorId: profile.id,
        status: {
          in: [
            BidStatus.clarifying,
            BidStatus.enrolled,
            BidStatus.submitted,
            BidStatus.selected,
          ],
        },
      },
      include: {
        tender: { include: { project: true } },
      },
      orderBy: [{ submittedAt: 'desc' }, { enrolledAt: 'desc' }],
    });

    const projectIds = [...new Set(bids.map((bid) => bid.tender.projectId))];
    const coverByProject =
      await this.projectsService.getCoverUrlsForProjects(projectIds);

    const items = bids.map((bid) => ({
      bidId: bid.id,
      tenderId: bid.tenderId,
      projectId: bid.tender.projectId,
      projectTitle: bid.tender.project.title,
      projectDistrict: bid.tender.project.district,
      projectStatus: bid.tender.project.status,
      projectType: bid.tender.project.projectType,
      description: bid.tender.project.description,
      coverImageUrl: coverByProject.get(bid.tender.projectId) ?? null,
      tenderStatus: bid.tender.status,
      bidStatus: bid.status,
      contenderNumber: bid.contenderNumber,
      bidAmount:
        bid.amount != null && bid.status === BidStatus.submitted
          ? bid.amount.toString()
          : bid.status === BidStatus.selected && bid.amount != null
            ? bid.amount.toString()
            : null,
      submittedAt: bid.submittedAt?.toISOString() ?? null,
      isActiveProject:
        bid.status === BidStatus.selected &&
        bid.tender.project.status !== ProjectStatus.completed,
    }));

    items.sort((a, b) => {
      const aCompleted = a.projectStatus === ProjectStatus.completed ? 1 : 0;
      const bCompleted = b.projectStatus === ProjectStatus.completed ? 1 : 0;
      if (aCompleted !== bCompleted) {
        return aCompleted - bCompleted;
      }
      const aTime = a.submittedAt ?? '';
      const bTime = b.submittedAt ?? '';
      return bTime.localeCompare(aTime);
    });

    return items;
  }

  async listInvitationsForContractor(userId: string): Promise<unknown[]> {
    return this.listApplicationsForContractor(userId);
  }

  async getParticipationForProject(
    userId: string,
    projectId: string,
    viewerLocale?: SupportedLocale,
  ) {
    const profile = await this.contractorProfiles.getByUserId(userId);
    if (!profile) {
      return null;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return null;
    }

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      include: this.includeTenderRelations(),
    });

    const myBid =
      tender?.bids.find(
        (b) =>
          b.contractorId === profile.id && b.status !== BidStatus.withdrawn,
      ) ?? null;

    const tenderAwarded =
      tender?.status === TenderStatus.awarded ||
      project.status === ProjectStatus.awarded;

    const accessDenied = Boolean(
      myBid && tenderAwarded && myBid.status !== BidStatus.selected,
    );

    const clarificationMode =
      project.clarificationMode ?? ClarificationMode.open_chat;
    const deadlinePassed = isApplicationsDeadlinePassed(tender?.closesAt);
    const tenderOpen = tender?.status === TenderStatus.open && !deadlinePassed;
    const tenderCollectingClarifications = Boolean(
      tender?.status === TenderStatus.draft &&
        clarificationMode === ClarificationMode.structured_qa,
    );

    let hasSubmittedClarificationQuestions = false;
    let clarificationProgress = {
      totalQuestions: 0,
      answeredQuestions: 0,
      allAnswered: false,
    };

    if (tender && clarificationMode === ClarificationMode.structured_qa) {
      clarificationProgress = await this.clarifications.getClarificationProgress(
        tender.id,
      );
      if (myBid) {
        hasSubmittedClarificationQuestions =
          await this.clarifications.hasSubmittedQuestions(myBid.id);
      }
    }

    const structuredReadyForEnroll =
      clarificationMode !== ClarificationMode.structured_qa ||
      hasSubmittedClarificationQuestions;

    const contract = await this.prisma.contract.findUnique({
      where: { projectId },
    });
    const contractFullySigned =
      contract?.status === ContractStatus.fully_signed;

    const defaultCostBreakdown = await this.defaultCostBreakdownForTender(
      tender,
    );
    const projectContractTerms = this.parseProjectContractTerms(
      project.tenderContractTermsJson,
    );

    let projectScopeSummary = project.scopeSummary;
    let projectClarificationSummary = project.clarificationSummary;
    let localizedContractTerms = projectContractTerms;
    let localizedCostBreakdown = defaultCostBreakdown;

    if (viewerLocale) {
      const localized =
        await this.projectLocalization.localizeTenderPackageTexts(
          projectId,
          {
            scopeSummary: project.scopeSummary,
            clarificationSummary: project.clarificationSummary,
            contractTerms: projectContractTerms,
            costBreakdown: defaultCostBreakdown,
            sourceLocale: project.sourceLocale,
          },
          viewerLocale,
        );
      if (localized.cacheMiss) {
        this.projectLocalization.scheduleWarmProjectTranslations(projectId);
      }
      projectScopeSummary = localized.scopeSummary;
      projectClarificationSummary = localized.clarificationSummary;
      localizedContractTerms = localized.contractTerms;
      localizedCostBreakdown = localized.costBreakdown;
    }

    return {
      tenderId: tender?.id ?? null,
      tenderStatus: tender?.status ?? null,
      closesAt: tender?.closesAt?.toISOString() ?? null,
      applicationsDeadlinePassed: deadlinePassed,
      myBid: myBid ? this.mapBid(myBid) : null,
      verificationStatus: profile.verificationStatus,
      clarificationMode,
      hasSubmittedClarificationQuestions,
      clarificationProgress,
      tenderCollectingClarifications,
      defaultCostBreakdown: localizedCostBreakdown,
      projectScopeSummary,
      projectClarificationSummary,
      projectContractTerms: localizedContractTerms,
      canStartClarification: Boolean(
        tenderCollectingClarifications && !myBid,
      ),
      canApply: Boolean(tenderOpen && !myBid),
      canEnroll: Boolean(
        tenderOpen &&
          myBid?.status === BidStatus.clarifying &&
          structuredReadyForEnroll,
      ),
      canSubmitProposal: Boolean(
        tenderOpen &&
          myBid &&
          (myBid.status === BidStatus.enrolled ||
            myBid.status === BidStatus.submitted),
      ),
      canEditCommercialProposal: Boolean(
        myBid?.status === BidStatus.selected && !contractFullySigned,
      ),
      canWithdrawFromAward: Boolean(
        myBid?.status === BidStatus.selected && !contractFullySigned,
      ),
      contractFullySigned,
      canWithdraw: Boolean(
        (tenderOpen || tenderCollectingClarifications) &&
          myBid &&
          (myBid.status === BidStatus.clarifying ||
            myBid.status === BidStatus.enrolled ||
            myBid.status === BidStatus.submitted),
      ),
      accessDenied,
      projectStatus: project.status,
    };
  }

  async startClarification(
    userId: string,
    tenderId: string,
  ): Promise<BidResponse> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const tender = await this.loadTender(tenderId);

    const project = await this.prisma.project.findUnique({
      where: { id: tender.projectId },
    });
    const structuredClarification =
      project?.clarificationMode === ClarificationMode.structured_qa;

    const clarificationAllowed =
      tender.status === TenderStatus.open ||
      (tender.status === TenderStatus.draft && structuredClarification);

    if (!clarificationAllowed) {
      throw new BadRequestException('Tender is not accepting clarification');
    }

    this.assertWithinApplicationsDeadline(tender);

    const existing = tender.bids.find(
      (b) =>
        b.contractorId === profile.id && b.status !== BidStatus.withdrawn,
    );
    if (existing) {
      const enrolled = await this.maybeAutoEnrollOpenChatParticipant(
        tender,
        existing,
      );
      return this.mapBid(enrolled);
    }

    const withdrawnBid = tender.bids.find(
      (b) =>
        b.contractorId === profile.id && b.status === BidStatus.withdrawn,
    );
    if (withdrawnBid) {
      const reopened = await this.reopenWithdrawnBid(withdrawnBid.id);
      const enrolled = await this.maybeAutoEnrollOpenChatParticipant(
        tender,
        reopened,
      );
      return this.mapBid(enrolled);
    }

    const bid = await this.prisma.bid.create({
      data: {
        tenderId,
        contractorId: profile.id,
        status: BidStatus.clarifying,
      },
      include: { contractor: true },
    });

    const enrolled = await this.maybeAutoEnrollOpenChatParticipant(
      tender,
      bid,
    );
    return this.mapBid(enrolled);
  }

  private async reopenWithdrawnBid(
    bidId: string,
  ): Promise<Bid & { contractor: ContractorProfile }> {
    return this.prisma.bid.update({
      where: { id: bidId },
      data: {
        status: BidStatus.clarifying,
        contenderNumber: null,
        enrolledAt: null,
        submittedAt: null,
        amount: null,
        durationDays: null,
        termsJson: Prisma.DbNull,
        withdrawalReason: null,
        withdrawalNote: null,
        withdrawnAt: null,
      },
      include: { contractor: true },
    });
  }

  private async maybeAutoEnrollOpenChatParticipant(
    tender: Tender & { bids: Bid[] },
    bid: Bid & { contractor: ContractorProfile },
  ): Promise<Bid & { contractor: ContractorProfile }> {
    if (
      tender.status !== TenderStatus.open ||
      bid.status !== BidStatus.clarifying
    ) {
      return bid;
    }

    return this.promoteBidToEnrolled(tender.id, bid.id);
  }

  private async enrollDiscussionParticipants(
    tenderId: string,
    clarificationMode: ClarificationMode,
  ): Promise<string[]> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: {
        bids: {
          where: { status: BidStatus.clarifying },
          include: { contractor: true },
        },
      },
    });
    if (!tender) {
      return [];
    }

    const enrolledUserIds: string[] = [];

    for (const bid of tender.bids) {
      if (clarificationMode === ClarificationMode.structured_qa) {
        const submitted = await this.clarifications.hasSubmittedQuestions(
          bid.id,
        );
        if (!submitted) {
          continue;
        }
      }

      const updated = await this.promoteBidToEnrolled(tenderId, bid.id);
      enrolledUserIds.push(updated.contractor.userId);
    }

    return enrolledUserIds;
  }

  private async promoteBidToEnrolled(
    tenderId: string,
    bidId: string,
  ): Promise<Bid & { contractor: ContractorProfile }> {
    const current = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: { contractor: true },
    });
    if (!current) {
      throw new NotFoundException('Bid not found');
    }
    if (current.status === BidStatus.enrolled) {
      return current;
    }
    if (current.status !== BidStatus.clarifying) {
      throw new BadRequestException('Bid cannot be enrolled in its current status');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const currentTender = await tx.tender.findUnique({
        where: { id: tenderId },
      });
      if (!currentTender) {
        throw new NotFoundException('Tender not found');
      }

      const contenderNumber = currentTender.nextContenderNumber;
      await tx.tender.update({
        where: { id: tenderId },
        data: { nextContenderNumber: contenderNumber + 1 },
      });

      return tx.bid.update({
        where: { id: bidId },
        data: {
          status: BidStatus.enrolled,
          contenderNumber,
          enrolledAt: new Date(),
        },
        include: { contractor: true },
      });
    });

    const tenderRow = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: { project: { select: { id: true, title: true, clientId: true } } },
    });
    if (tenderRow && updated.contenderNumber != null) {
      this.notifications.dispatch(
        this.notifications.notifyClientBidEnrolled({
          clientId: tenderRow.project.clientId,
          projectId: tenderRow.project.id,
          projectTitle: tenderRow.project.title,
          companyName: updated.contractor.companyName ?? 'Contractor',
          contenderNumber: updated.contenderNumber,
        }),
      );
    }

    return updated;
  }

  async enrollInTender(userId: string, tenderId: string): Promise<BidResponse> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const tender = await this.loadTender(tenderId);

    if (tender.status !== TenderStatus.open) {
      throw new BadRequestException('Tender is not open');
    }

    this.assertWithinApplicationsDeadline(tender);

    const bid = tender.bids.find(
      (b) =>
        b.contractorId === profile.id && b.status === BidStatus.clarifying,
    );
    if (!bid) {
      throw new BadRequestException(
        'Start clarification and discuss scope before enrolling',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: tender.projectId },
    });
    if (project?.clarificationMode === ClarificationMode.structured_qa) {
      const submitted = await this.clarifications.hasSubmittedQuestions(bid.id);
      if (!submitted) {
        throw new BadRequestException(
          'Submit your question list before enrolling',
        );
      }
    }

    const updated = await this.promoteBidToEnrolled(tenderId, bid.id);
    return this.mapBid(updated);
  }

  private buildBidTerms(dto: SubmitBidDto): BidTermsV1 {
    const notes = dto.notes?.trim();
    const approach = dto.approach?.trim();
    const scopeSummary = dto.scopeSummary?.trim();

    if (notes && notes.length > MAX_BID_NOTES_LENGTH) {
      throw new BadRequestException(
        `Comment must be at most ${MAX_BID_NOTES_LENGTH} characters`,
      );
    }
    if (approach && approach.length > MAX_BID_APPROACH_LENGTH) {
      throw new BadRequestException(
        `Implementation proposal must be at most ${MAX_BID_APPROACH_LENGTH} characters`,
      );
    }
    if (scopeSummary && scopeSummary.length > MAX_BID_SCOPE_LENGTH) {
      throw new BadRequestException(
        `Scope summary must be at most ${MAX_BID_SCOPE_LENGTH} characters`,
      );
    }

    let lineItems = dto.lineItems;
    if (lineItems?.length) {
      if (lineItems.length > MAX_BID_LINE_ITEMS) {
        throw new BadRequestException(
          `At most ${MAX_BID_LINE_ITEMS} line items allowed`,
        );
      }
      lineItems = lineItems.map((item) => {
        const trade = item.trade?.trim();
        const description = item.description?.trim();
        const amount = Number(item.amount);
        if (!trade) {
          throw new BadRequestException('Each line item needs a trade');
        }
        if (!Number.isFinite(amount) || amount < 0) {
          throw new BadRequestException(
            'Line item amounts must be zero or positive',
          );
        }
        return {
          trade,
          ...(description ? { description } : {}),
          amount,
        };
      });
    }

    return {
      notes: notes || undefined,
      approach: approach || undefined,
      scopeSummary: scopeSummary || undefined,
      lineItems: lineItems?.length ? lineItems : undefined,
      contractTerms: this.normalizeAndValidateContractTerms(dto.contractTerms),
    };
  }

  private normalizeAndValidateContractTerms(
    raw?: SubmitBidDto['contractTerms'],
  ) {
    const contractTerms = normalizeContractTerms(raw);
    if (
      contractTerms?.specialConditions &&
      contractTerms.specialConditions.length > MAX_BID_SPECIAL_CONDITIONS_LENGTH
    ) {
      throw new BadRequestException(
        `Special conditions must be at most ${MAX_BID_SPECIAL_CONDITIONS_LENGTH} characters`,
      );
    }
    return contractTerms;
  }

  private mergeContractTerms(
    existingTerms: BidTermsV1 | null,
    incoming?: SubmitBidDto['contractTerms'],
    projectTerms?: BidContractTerms,
  ): SubmitBidDto['contractTerms'] {
    if (!incoming && !existingTerms?.contractTerms && !projectTerms) {
      return undefined;
    }

    const merged: BidContractTerms = {
      ...projectTerms,
      ...existingTerms?.contractTerms,
      ...incoming,
    };

    const clientOnlyKeys: (keyof BidContractTerms)[] = [
      'siteAddress',
      'propertyOwnership',
      'employerName',
      'employerAddress',
      'employerRegistrationNo',
    ];
    const contractorOnlyKeys: (keyof BidContractTerms)[] = [
      'subjectOfContract',
      'contractorAddress',
      'contractorRegistrationNo',
      'contractorRepresentative',
    ];

    if (incoming) {
      for (const key of clientOnlyKeys) {
        if (incoming[key] === undefined) {
          const preserved =
            existingTerms?.contractTerms?.[key] ?? projectTerms?.[key];
          if (preserved !== undefined) {
            (merged as Record<string, BidContractTerms[keyof BidContractTerms]>)[
              key
            ] = preserved;
          }
        }
      }
      for (const key of contractorOnlyKeys) {
        if (incoming[key] === undefined) {
          const preserved =
            existingTerms?.contractTerms?.[key] ?? projectTerms?.[key];
          if (preserved !== undefined) {
            (merged as Record<string, BidContractTerms[keyof BidContractTerms]>)[
              key
            ] = preserved;
          }
        }
      }
    }

    return merged;
  }

  private pickClientOnlyContractTerms(
    incoming?: BidContractTerms,
  ): BidContractTerms | undefined {
    if (!incoming) {
      return undefined;
    }
    const clientOnlyKeys: (keyof BidContractTerms)[] = [
      'siteAddress',
      'propertyOwnership',
      'employerName',
      'employerAddress',
      'employerRegistrationNo',
    ];
    const picked: BidContractTerms = {};
    for (const key of clientOnlyKeys) {
      if (incoming[key] !== undefined) {
        (picked as Record<string, BidContractTerms[keyof BidContractTerms]>)[
          key
        ] = incoming[key] as BidContractTerms[keyof BidContractTerms];
      }
    }
    return Object.keys(picked).length > 0 ? picked : undefined;
  }

  private mergeContractTermsForContractor(
    existingTerms: BidTermsV1 | null,
    incoming?: SubmitBidDto['contractTerms'],
    projectTerms?: BidContractTerms,
  ): SubmitBidDto['contractTerms'] {
    const merged = this.mergeContractTerms(
      existingTerms,
      incoming,
      projectTerms,
    );
    if (!merged) {
      return merged;
    }

    const clientOnlyKeys: (keyof BidContractTerms)[] = [
      'siteAddress',
      'propertyOwnership',
      'employerName',
      'employerAddress',
      'employerRegistrationNo',
    ];
    const contractorOnlyKeys: (keyof BidContractTerms)[] = [
      'subjectOfContract',
      'contractorAddress',
      'contractorRegistrationNo',
      'contractorRepresentative',
    ];

    for (const key of clientOnlyKeys) {
      const preserved =
        existingTerms?.contractTerms?.[key] ?? projectTerms?.[key];
      if (preserved !== undefined) {
        (merged as Record<string, BidContractTerms[keyof BidContractTerms]>)[
          key
        ] = preserved;
      }
    }

    for (const key of contractorOnlyKeys) {
      const preserved =
        existingTerms?.contractTerms?.[key] ?? projectTerms?.[key];
      if (preserved !== undefined) {
        (merged as Record<string, BidContractTerms[keyof BidContractTerms]>)[
          key
        ] = preserved;
      }
    }

    return merged;
  }

  private async assertBidContractTermsEditable(bidId: string): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { bidId },
    });
    if (contract?.status === ContractStatus.fully_signed) {
      throw new BadRequestException(
        'Contract is fully signed and can no longer be edited',
      );
    }
  }

  async submitBid(
    userId: string,
    tenderId: string,
    dto: SubmitBidDto,
  ): Promise<BidResponse> {
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('Bid amount must be a positive number');
    }

    const profile = await this.contractorProfiles.requireByUserId(userId);
    const tender = await this.loadTender(tenderId);
    const project = await this.prisma.project.findUnique({
      where: { id: tender.projectId },
    });
    const projectTerms = project
      ? this.resolveProjectContractTerms(project)
      : undefined;

    if (tender.status !== TenderStatus.open) {
      throw new BadRequestException(
        tender.status === TenderStatus.closed
          ? 'Tender is closed for new bids'
          : 'Tender is not open for bids',
      );
    }

    this.assertWithinApplicationsDeadline(tender);

    const existing = tender.bids.find(
      (b) =>
        b.contractorId === profile.id &&
        (b.status === BidStatus.enrolled ||
          b.status === BidStatus.submitted),
    );
    if (!existing) {
      throw new BadRequestException(
        'Enroll as a contender before submitting a commercial proposal',
      );
    }

    const terms = this.buildBidTerms({
      ...dto,
      contractTerms: this.mergeContractTerms(
        (existing.termsJson as BidTermsV1 | null) ?? null,
        dto.contractTerms,
        projectTerms,
      ),
    });
    assertBreakdownMatchesTotal(dto.amount, terms.lineItems);

    const bid = await this.prisma.$transaction(async (tx) => {
      const nextBid = await tx.bid.update({
        where: { id: existing.id },
        data: {
          amount: dto.amount,
          durationDays: dto.durationDays ?? null,
          termsJson: terms as unknown as Prisma.InputJsonValue,
          status: BidStatus.submitted,
          submittedAt: new Date(),
        },
        include: { contractor: true },
      });

      await tx.bidOffer.create({
        data: {
          bidId: existing.id,
          authorRole: 'contractor',
          authorId: userId,
          amount: dto.amount,
          durationDays: dto.durationDays ?? null,
          termsJson: terms as unknown as Prisma.InputJsonValue,
          note: dto.notes?.trim() || null,
        },
      });

      return nextBid;
    });

    const tenderRow = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: { project: { select: { id: true, title: true, clientId: true } } },
    });
    if (tenderRow) {
      this.notifications.dispatch(
        this.notifications.notifyClientBidSubmitted({
          clientId: tenderRow.project.clientId,
          projectId: tenderRow.project.id,
          projectTitle: tenderRow.project.title,
          companyName: bid.contractor.companyName ?? 'Contractor',
          amount: String(dto.amount),
        }),
      );
      this.projectLocalization.scheduleWarmBidTerms(
        tenderRow.project.id,
        `bid.${bid.id}`,
        terms,
      );
    }

    return this.mapBid(bid);
  }

  async updateBidContractTermsForClient(
    clientId: string,
    projectId: string,
    bidId: string,
    dto: UpdateBidContractTermsDto,
    locale: SupportedLocale = 'en',
  ): Promise<BidResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }

    const bid = await this.prisma.bid.findFirst({
      where: { id: bidId, tender: { projectId } },
      include: { contractor: true },
    });
    if (!bid) {
      throw new NotFoundException('Bid not found');
    }

    const editableStatuses: BidStatus[] = [
      BidStatus.selected,
    ];
    if (!editableStatuses.includes(bid.status)) {
      throw new BadRequestException(
        'Commercial proposal terms cannot be edited directly after submission. Send a counter-offer to propose changes.',
      );
    }

    await this.assertBidContractTermsEditable(bidId);

    const existingTerms = (bid.termsJson as BidTermsV1 | null) ?? {};
    const projectTerms = this.resolveProjectContractTerms(project);
    // After award, the client may only adjust employer / site fields — not the
    // contractor's commercial terms (those go through counter-offer earlier).
    const clientOnlyIncoming = this.pickClientOnlyContractTerms(dto.contractTerms);
    const contractTerms = this.normalizeAndValidateContractTerms(
      this.mergeContractTerms(existingTerms, clientOnlyIncoming, projectTerms),
    );

    const updatedTerms: BidTermsV1 = {
      ...existingTerms,
      contractTerms,
    };

    const updated = await this.prisma.bid.update({
      where: { id: bidId },
      data: {
        termsJson: updatedTerms as unknown as Prisma.InputJsonValue,
      },
      include: { contractor: true },
    });

    this.notifications.dispatch(
      this.notifications.notifyContractTermsUpdated({
        recipientUserId: updated.contractor.userId,
        recipientRole: 'contractor',
        editorRole: 'client',
        projectId,
        projectTitle: project.title,
      }),
    );

    return this.localizeBidResponse(projectId, this.mapBid(updated), locale);
  }

  async updateBidContractTermsForContractor(
    userId: string,
    bidId: string,
    dto: UpdateBidContractTermsDto,
  ): Promise<BidResponse> {
    const profile = await this.contractorProfiles.requireByUserId(userId);

    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        contractor: true,
        tender: { include: { project: true } },
      },
    });
    if (!bid || bid.contractorId !== profile.id) {
      throw new NotFoundException('Bid not found');
    }

    if (bid.status !== BidStatus.selected) {
      throw new BadRequestException(
        'Contract terms can be updated only for the selected bid',
      );
    }

    await this.assertBidContractTermsEditable(bidId);

    const existingTerms = (bid.termsJson as BidTermsV1 | null) ?? {};
    const projectTerms = this.resolveProjectContractTerms(bid.tender.project);
    const contractTerms = this.normalizeAndValidateContractTerms(
      this.mergeContractTermsForContractor(
        existingTerms,
        dto.contractTerms,
        projectTerms,
      ),
    );

    const updatedTerms: BidTermsV1 = {
      ...existingTerms,
      contractTerms,
    };

    const updated = await this.prisma.bid.update({
      where: { id: bidId },
      data: {
        termsJson: updatedTerms as unknown as Prisma.InputJsonValue,
      },
      include: { contractor: true },
    });

    this.projectLocalization.scheduleWarmBidTerms(
      bid.tender.projectId,
      `bid.${bidId}`,
      updatedTerms,
    );

    this.notifications.dispatch(
      this.notifications.notifyContractTermsUpdated({
        recipientUserId: bid.tender.project.clientId,
        recipientRole: 'client',
        editorRole: 'contractor',
        projectId: bid.tender.projectId,
        projectTitle: bid.tender.project.title,
      }),
    );

    return this.mapBid(updated);
  }

  async withdrawBid(
    userId: string,
    tenderId: string,
    dto: WithdrawBidDto = {},
  ): Promise<BidResponse> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const tender = await this.loadTender(tenderId);

    const project = await this.prisma.project.findUnique({
      where: { id: tender.projectId },
      include: { contract: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const selectedBid = tender.bids.find(
      (b) =>
        b.contractorId === profile.id && b.status === BidStatus.selected,
    );
    if (
      selectedBid &&
      tender.status === TenderStatus.awarded &&
      project.contract?.status !== ContractStatus.fully_signed
    ) {
      await this.revertAwardToTender(tender.projectId, 'contractor');
      const withdrawn = await this.prisma.bid.findUniqueOrThrow({
        where: { id: selectedBid.id },
        include: { contractor: true },
      });
      return this.mapBid(withdrawn);
    }

    const structuredClarification =
      project.clarificationMode === ClarificationMode.structured_qa;
    const withdrawalAllowed =
      tender.status === TenderStatus.open ||
      (tender.status === TenderStatus.draft && structuredClarification);

    if (!withdrawalAllowed) {
      throw new BadRequestException('Tender is not open');
    }

    const bid = tender.bids.find(
      (b) =>
        b.contractorId === profile.id &&
        (b.status === BidStatus.clarifying ||
          b.status === BidStatus.enrolled ||
          b.status === BidStatus.submitted),
    );
    if (!bid) {
      throw new NotFoundException('No active bid to withdraw');
    }

    const requiresDeclineReason =
      bid.status === BidStatus.enrolled || bid.status === BidStatus.submitted;
    const { reason, note } = this.resolveWithdrawalReason(
      dto,
      requiresDeclineReason,
    );

    const updated = await this.prisma.bid.update({
      where: { id: bid.id },
      data: {
        status: BidStatus.withdrawn,
        withdrawalReason: reason,
        withdrawalNote: note,
        withdrawnAt: new Date(),
      },
      include: { contractor: true },
    });

    if (requiresDeclineReason && reason) {
      const companyName =
        updated.contractor.companyName?.trim() || 'A contractor';
      this.notifications.dispatch(
        this.notifications.notifyClientContractorDeclinedProposal({
          clientId: project.clientId,
          projectId: project.id,
          projectTitle: project.title,
          companyName,
          reasonCode: reason,
          reasonNote: note,
        }),
      );
    }

    return this.mapBid(updated);
  }

  private resolveWithdrawalReason(
    dto: WithdrawBidDto,
    required: boolean,
  ): {
    reason: BidWithdrawalReason | null;
    note: string | null;
  } {
    const code = dto.reasonCode?.trim() as BidWithdrawalReasonCode | undefined;
    const note = dto.reasonNote?.trim() || null;

    if (!code) {
      if (required) {
        throw new BadRequestException(
          'Please select a reason for declining to submit a proposal',
        );
      }
      return { reason: null, note: null };
    }

    if (!BID_WITHDRAWAL_REASON_CODES.includes(code)) {
      throw new BadRequestException('Invalid withdrawal reason');
    }

    if (code === 'other') {
      if (!note || note.length < 3) {
        throw new BadRequestException(
          'Please describe the reason for declining',
        );
      }
      if (note.length > 1000) {
        throw new BadRequestException('Reason note is too long');
      }
      return { reason: BidWithdrawalReason.other, note };
    }

    if (note && note.length > 1000) {
      throw new BadRequestException('Reason note is too long');
    }

    return {
      reason: code as BidWithdrawalReason,
      note,
    };
  }

  async getTenderForContractor(userId: string, tenderId: string) {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const tender = await this.loadTender(tenderId);

    const myBid =
      tender.bids.find(
        (b) =>
          b.contractorId === profile.id && b.status !== BidStatus.withdrawn,
      ) ?? null;

    return { tender: this.mapTender(tender), myBid: myBid ? this.mapBid(myBid) : null };
  }

  private projectPublishPackageUpdate(
    dto?: PublishTenderDto,
  ): Prisma.ProjectUpdateInput {
    if (!dto) {
      return {};
    }

    const data: Prisma.ProjectUpdateInput = {};

    if (dto.scopeSummary !== undefined) {
      const scopeSummary = dto.scopeSummary.trim();
      if (scopeSummary.length > MAX_BID_SCOPE_LENGTH) {
        throw new BadRequestException(
          `Scope must be at most ${MAX_BID_SCOPE_LENGTH} characters`,
        );
      }
      data.scopeSummary = scopeSummary || null;
    }

    if (dto.clarificationSummary !== undefined) {
      data.clarificationSummary = dto.clarificationSummary.trim() || null;
    }

    if (dto.contractTerms !== undefined) {
      const normalizedTerms = normalizeContractTerms(dto.contractTerms);
      data.tenderContractTermsJson =
        normalizedTerms as unknown as Prisma.InputJsonValue;
      const ownershipForm = inferPropertyOwnershipForm(
        normalizedTerms?.propertyOwnership,
      );
      if (ownershipForm) {
        data.propertyOwnershipForm = ownershipForm;
      }
    }

    return data;
  }

  private normalizePublishCostBreakdown(
    items: DefaultCostBreakdownItem[],
  ): DefaultCostBreakdownItem[] {
    return this.costBreakdown.parseStored(items);
  }

  private parseProjectContractTerms(raw: unknown): BidContractTerms {
    if (!raw || typeof raw !== 'object') {
      return {};
    }
    return normalizeContractTerms(raw as BidContractTerms) ?? {};
  }
}
