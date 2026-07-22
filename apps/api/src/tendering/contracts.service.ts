import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
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
import { CommercialProposalService } from './commercial-proposal.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import { sanitizeContractBodyHtml } from './contract-html.sanitize';
import { ContractResponse } from './contracts.types';
import {
  normalizeOptionalSignatureDataUrl,
  type SignContractDto,
  type UpdateContractDocumentDto,
} from './contracts.types';

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
    @Inject(forwardRef(() => CommercialProposalService))
    private readonly commercialProposal: CommercialProposalService,
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
    const canEditDocument =
      !fullySigned &&
      project.status === ProjectStatus.awarded &&
      (participant.isClient || participant.isSelectedContractor);

    return {
      id: contract.id,
      projectId: contract.projectId,
      bidId: contract.bidId,
      status: contract.status,
      projectStatus: project.status,
      clientSignedAt: contract.clientSignedAt?.toISOString() ?? null,
      contractorSignedAt: contract.contractorSignedAt?.toISOString() ?? null,
      hasClientSignature: Boolean(contract.clientSignatureDataUrl),
      hasContractorSignature: Boolean(contract.contractorSignatureDataUrl),
      englishBodyHtml: contract.englishBodyHtml ?? null,
      canSign,
      canEditDocument,
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
    let contract = participant.project.contract;
    if (!contract) {
      return null;
    }

    if (!contract.englishBodyHtml?.trim()) {
      contract = await this.ensureEnglishBodyHtml(contract);
    }

    return this.toResponse(contract, participant.project, participant);
  }

  async updateDocument(
    userId: string,
    projectId: string,
    dto: UpdateContractDocumentDto,
  ): Promise<ContractResponse> {
    const participant = await this.loadParticipant(userId, projectId);
    const { project } = participant;
    const contract = project.contract;

    if (!contract) {
      throw new NotFoundException('Contract not found for this project');
    }

    if (contract.status === ContractStatus.fully_signed) {
      throw new BadRequestException(
        'Fully signed contracts cannot be edited',
      );
    }

    if (project.status !== ProjectStatus.awarded) {
      throw new BadRequestException(
        'Contract document can only be edited while awaiting signatures',
      );
    }

    let sanitized: string;
    try {
      sanitized = sanitizeContractBodyHtml(dto.englishBodyHtml);
    } catch (err: unknown) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid document content',
      );
    }

    const previousBody = (contract.englishBodyHtml ?? '').trim();
    if (previousBody === sanitized) {
      return this.toResponse(contract, project, participant);
    }

    const updated = await this.prisma.contract.update({
      where: { id: contract.id },
      data: { englishBodyHtml: sanitized },
    });

    const editorRole = participant.isClient ? 'client' : 'contractor';
    const contractorUserId =
      project.tender?.awardedBid?.contractor.userId ?? null;
    const recipientUserId =
      editorRole === 'client' ? contractorUserId : project.clientId;
    const recipientRole =
      editorRole === 'client' ? 'contractor' : 'client';

    if (recipientUserId) {
      this.notifications.dispatch(
        this.notifications.notifyContractDocumentUpdated({
          recipientUserId,
          recipientRole,
          editorRole,
          projectId,
          projectTitle: project.title,
        }),
      );
    }

    return this.toResponse(updated, project, participant);
  }

  async ensureEnglishBodyHtml(contract: Contract): Promise<Contract> {
    if (contract.englishBodyHtml?.trim()) {
      return contract;
    }

    try {
      const body = await this.commercialProposal.generateEnglishBodyHtml(
        contract.bidId,
      );
      return this.prisma.contract.update({
        where: { id: contract.id },
        data: { englishBodyHtml: body },
      });
    } catch {
      return contract;
    }
  }

  async signForProject(
    userId: string,
    projectId: string,
    dto: SignContractDto = {},
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

    let signatureDataUrl: string | null = null;
    try {
      signatureDataUrl = normalizeOptionalSignatureDataUrl(dto.signatureDataUrl);
    } catch (err: unknown) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid signature',
      );
    }

    const now = new Date();
    const otherPartySigned = isClient
      ? Boolean(contract.contractorSignedAt)
      : Boolean(contract.clientSignedAt);

    const updateData: Prisma.ContractUpdateInput = isClient
      ? {
          clientSignedAt: now,
          ...(signatureDataUrl
            ? { clientSignatureDataUrl: signatureDataUrl }
            : {}),
        }
      : {
          contractorSignedAt: now,
          ...(signatureDataUrl
            ? { contractorSignatureDataUrl: signatureDataUrl }
            : {}),
        };

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

  /** Populate englishBodyHtml after award transaction commits. */
  async generateEnglishBodyAfterAward(projectId: string): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { projectId },
    });
    if (!contract || contract.englishBodyHtml?.trim()) {
      return;
    }
    await this.ensureEnglishBodyHtml(contract);
  }
}
