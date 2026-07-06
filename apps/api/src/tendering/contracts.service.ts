import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Contract,
  ContractStatus,
  Prisma,
  Project,
  ProjectStatus,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import { ContractResponse } from './contracts.types';

type ContractParticipant = {
  project: Project & {
    tender: {
      awardedBid: {
        contractorId: string;
        contractor: { userId: string };
      } | null;
    } | null;
    contract: Contract | null;
  };
  isClient: boolean;
  isSelectedContractor: boolean;
};

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly notifications: NotificationsService,
  ) {}

  private toResponse(
    contract: Contract,
    project: Project,
    participant: Pick<ContractParticipant, 'isClient' | 'isSelectedContractor'>,
  ): ContractResponse {
    const clientSigned = Boolean(contract.clientSignedAt);
    const contractorSigned = Boolean(contract.contractorSignedAt);
    const fullySigned = contract.status === ContractStatus.fully_signed;
    const canSign =
      project.status === ProjectStatus.awarded &&
      contract.status === ContractStatus.pending_signatures &&
      ((participant.isClient && !clientSigned) ||
        (participant.isSelectedContractor && !contractorSigned));

    return {
      id: contract.id,
      projectId: contract.projectId,
      bidId: contract.bidId,
      status: contract.status,
      projectStatus: project.status,
      clientSignedAt: contract.clientSignedAt?.toISOString() ?? null,
      contractorSignedAt: contract.contractorSignedAt?.toISOString() ?? null,
      canSign,
      fullySigned,
    };
  }

  private async loadParticipant(
    userId: string,
    projectId: string,
  ): Promise<ContractParticipant> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tender: {
          include: {
            awardedBid: {
              include: {
                contractor: { select: { userId: true } },
              },
            },
          },
        },
        contract: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isClient = project.clientId === userId;
    const profile = await this.contractorProfiles.getByUserId(userId);
    const isSelectedContractor = Boolean(
      profile &&
        project.tender?.awardedBid &&
        project.tender.awardedBid.contractorId === profile.id,
    );

    if (!isClient && !isSelectedContractor) {
      throw new ForbiddenException('Access denied');
    }

    return { project, isClient, isSelectedContractor };
  }

  async getForProject(
    userId: string,
    projectId: string,
  ): Promise<ContractResponse | null> {
    const participant = await this.loadParticipant(userId, projectId);
    const contract = participant.project.contract;
    if (!contract) {
      return null;
    }

    return this.toResponse(contract, participant.project, participant);
  }

  async signForProject(
    userId: string,
    projectId: string,
  ): Promise<ContractResponse> {
    const participant = await this.loadParticipant(userId, projectId);
    const { project, isClient, isSelectedContractor } = participant;
    const contract = project.contract;

    if (!contract) {
      throw new NotFoundException('Contract not found for this project');
    }

    if (contract.status === ContractStatus.fully_signed) {
      return this.toResponse(contract, project, participant);
    }

    if (project.status !== ProjectStatus.awarded) {
      throw new BadRequestException(
        'Contract can only be signed while the project is awaiting signatures',
      );
    }

    if (isClient && contract.clientSignedAt) {
      throw new BadRequestException('You have already signed this contract');
    }

    if (isSelectedContractor && contract.contractorSignedAt) {
      throw new BadRequestException('You have already signed this contract');
    }

    const now = new Date();
    const otherPartySigned = isClient
      ? Boolean(contract.contractorSignedAt)
      : Boolean(contract.clientSignedAt);

    const updateData: Prisma.ContractUpdateInput = isClient
      ? { clientSignedAt: now }
      : { contractorSignedAt: now };

    if (otherPartySigned) {
      updateData.status = ContractStatus.fully_signed;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextContract = await tx.contract.update({
        where: { id: contract.id },
        data: updateData,
      });

      if (nextContract.status === ContractStatus.fully_signed) {
        await tx.project.update({
          where: { id: projectId },
          data: { status: ProjectStatus.active },
        });
      }

      return nextContract;
    });

    const refreshedProject = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    const response = this.toResponse(updated, refreshedProject, participant);

    if (updated.status === ContractStatus.fully_signed) {
      const contractorUserId =
        project.tender?.awardedBid?.contractor.userId ?? null;
      if (contractorUserId) {
        this.notifications.dispatch(
          this.notifications.notifyContractFullySigned({
            clientUserId: project.clientId,
            contractorUserId,
            projectId,
            projectTitle: project.title,
          }),
        );
      }
    } else {
      const contractorUserId =
        project.tender?.awardedBid?.contractor.userId ?? null;
      if (contractorUserId) {
        this.notifications.dispatch(
          this.notifications.notifyContractPartySigned({
            recipientUserId: isClient ? contractorUserId : project.clientId,
            signerRole: isClient ? 'client' : 'contractor',
            projectId,
            projectTitle: project.title,
          }),
        );
      }
    }

    return response;
  }

  async createForAwardedBid(
    tx: Prisma.TransactionClient,
    projectId: string,
    bidId: string,
  ): Promise<void> {
    await tx.contract.create({
      data: {
        projectId,
        bidId,
        status: ContractStatus.pending_signatures,
      },
    });
  }
}
