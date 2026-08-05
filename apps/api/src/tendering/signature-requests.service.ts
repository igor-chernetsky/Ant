import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractSignatureRequestStatus,
  ContractStatus,
  Prisma,
  ProjectStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildPlatformFeeSnapshot } from '../notifications/platform-fees';
import { ContractorProfilesService } from './contractor-profiles.service';
import type {
  RejectSignatureRequestDto,
  SignatureRequestListItemDto,
} from './signature-requests.types';

function decimalToNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

@Injectable()
export class SignatureRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly notifications: NotificationsService,
  ) {}

  private mapListItem(row: {
    id: string;
    status: ContractSignatureRequestStatus;
    projectId: string;
    contractId: string;
    contractorId: string;
    companyName: string | null;
    bankName: string | null;
    bankAccount: string | null;
    currency: string;
    contractAmount: Prisma.Decimal | null;
    accessFeeUsd: Prisma.Decimal;
    dueNowListed: Prisma.Decimal | null;
    dueNowPayable: Prisma.Decimal;
    successFeeGross: Prisma.Decimal | null;
    trialActive: boolean;
    rejectionReason: string | null;
    createdAt: Date;
    reviewedAt: Date | null;
    project: { title: string };
    contractor: { user: { email: string | null } };
  }): SignatureRequestListItemDto {
    return {
      id: row.id,
      status: row.status,
      projectId: row.projectId,
      projectTitle: row.project.title,
      contractId: row.contractId,
      contractorId: row.contractorId,
      companyName: row.companyName,
      contractorEmail: row.contractor.user.email,
      bankName: row.bankName,
      bankAccount: row.bankAccount,
      currency: row.currency,
      contractAmount: decimalToNumber(row.contractAmount),
      accessFeeUsd: decimalToNumber(row.accessFeeUsd) ?? 0,
      dueNowListed: decimalToNumber(row.dueNowListed),
      dueNowPayable: decimalToNumber(row.dueNowPayable) ?? 0,
      successFeeGross: decimalToNumber(row.successFeeGross),
      trialActive: row.trialActive,
      rejectionReason: row.rejectionReason,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }

  async createForProject(userId: string, projectId: string) {
    const profile = await this.contractorProfiles.getByUserId(userId);
    if (!profile) {
      throw new ForbiddenException('Contractor profile required');
    }

    const bankName = profile.bankName?.trim() || '';
    const bankAccount = profile.bankAccount?.trim() || '';
    if (!bankName || !bankAccount) {
      throw new BadRequestException(
        'Fill in bank name and settlement account in your profile before requesting signature authorization',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        contract: true,
        tender: {
          include: {
            awardedBid: true,
          },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (!project.contract) {
      throw new NotFoundException('Contract not found for this project');
    }
    if (project.status !== ProjectStatus.awarded) {
      throw new BadRequestException(
        'Signature authorization is only available while awaiting signatures',
      );
    }
    if (project.contract.status === ContractStatus.fully_signed) {
      throw new BadRequestException('Contract is already fully signed');
    }
    if (project.tender?.awardedBid?.contractorId !== profile.id) {
      throw new ForbiddenException('Only the awarded contractor can request authorization');
    }
    if (project.platformFeePaid) {
      throw new BadRequestException('Signature authorization is already approved for this project');
    }

    const pending = await this.prisma.contractSignatureRequest.findFirst({
      where: {
        projectId,
        status: ContractSignatureRequestStatus.pending,
      },
    });
    if (pending) {
      throw new BadRequestException(
        'A signature authorization request is already pending review',
      );
    }

    const awardedBid = project.tender?.awardedBid ?? null;
    const contractAmount =
      awardedBid?.amount != null ? Number(awardedBid.amount) : null;
    const snapshot = buildPlatformFeeSnapshot({
      contractAmount:
        contractAmount != null && Number.isFinite(contractAmount)
          ? contractAmount
          : null,
      currency: project.tender?.currency ?? 'THB',
    });

    const created = await this.prisma.contractSignatureRequest.create({
      data: {
        projectId,
        contractId: project.contract.id,
        contractorId: profile.id,
        requestedById: userId,
        status: ContractSignatureRequestStatus.pending,
        contractAmount: snapshot.contractAmount,
        currency: snapshot.currency,
        accessFeeUsd: snapshot.accessFeeUsd,
        dueNowListed: snapshot.dueNowListed,
        dueNowPayable: snapshot.dueNowPayable,
        successFeeGross: snapshot.successFeeGross,
        trialActive: snapshot.trialActive,
        bankName,
        bankAccount,
        companyName: profile.companyName?.trim() || null,
      },
      include: {
        project: { select: { title: true } },
        contractor: { include: { user: { select: { email: true } } } },
      },
    });

    this.notifications.dispatch(
      this.notifications.notifyAdminSignatureRequestCreated({
        requestId: created.id,
        projectId,
        projectTitle: created.project.title,
        companyName: created.companyName,
        contractorEmail: created.contractor.user.email,
        bankName: created.bankName,
        bankAccount: created.bankAccount,
        currency: created.currency,
        contractAmount: decimalToNumber(created.contractAmount),
        dueNowListed: decimalToNumber(created.dueNowListed),
        dueNowPayable: decimalToNumber(created.dueNowPayable) ?? 0,
        trialActive: created.trialActive,
      }),
    );

    return this.mapListItem(created);
  }

  async listForAdmin(status?: ContractSignatureRequestStatus | '') {
    const rows = await this.prisma.contractSignatureRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        project: { select: { title: true } },
        contractor: { include: { user: { select: { email: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const pending = rows.filter(
      (r) => r.status === ContractSignatureRequestStatus.pending,
    );
    const rest = rows.filter(
      (r) => r.status !== ContractSignatureRequestStatus.pending,
    );
    return [...pending, ...rest].map((row) => this.mapListItem(row));
  }

  async approve(adminUserId: string, requestId: string) {
    const request = await this.prisma.contractSignatureRequest.findUnique({
      where: { id: requestId },
      include: {
        project: { select: { id: true, title: true } },
        contractor: { select: { userId: true } },
      },
    });
    if (!request) {
      throw new NotFoundException('Signature request not found');
    }
    if (request.status !== ContractSignatureRequestStatus.pending) {
      throw new BadRequestException('Only pending requests can be approved');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.contractSignatureRequest.update({
        where: { id: requestId },
        data: {
          status: ContractSignatureRequestStatus.approved,
          reviewedById: adminUserId,
          reviewedAt: now,
          rejectionReason: null,
        },
        include: {
          project: { select: { title: true } },
          contractor: { include: { user: { select: { email: true } } } },
        },
      });
      await tx.project.update({
        where: { id: request.projectId },
        data: { platformFeePaid: true },
      });
      return next;
    });

    this.notifications.dispatch(
      this.notifications.notifyContractorSignatureRequestDecision({
        contractorUserId: request.contractor.userId,
        projectId: request.projectId,
        projectTitle: request.project.title,
        approved: true,
      }),
    );

    return this.mapListItem(updated);
  }

  async reject(
    adminUserId: string,
    requestId: string,
    body: RejectSignatureRequestDto,
  ) {
    const reason = body.reason?.trim() ?? '';
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const request = await this.prisma.contractSignatureRequest.findUnique({
      where: { id: requestId },
      include: {
        project: { select: { id: true, title: true } },
        contractor: { select: { userId: true } },
      },
    });
    if (!request) {
      throw new NotFoundException('Signature request not found');
    }
    if (request.status !== ContractSignatureRequestStatus.pending) {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    const updated = await this.prisma.contractSignatureRequest.update({
      where: { id: requestId },
      data: {
        status: ContractSignatureRequestStatus.rejected,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        project: { select: { title: true } },
        contractor: { include: { user: { select: { email: true } } } },
      },
    });

    this.notifications.dispatch(
      this.notifications.notifyContractorSignatureRequestDecision({
        contractorUserId: request.contractor.userId,
        projectId: request.projectId,
        projectTitle: request.project.title,
        approved: false,
        rejectionReason: reason,
      }),
    );

    return this.mapListItem(updated);
  }
}
