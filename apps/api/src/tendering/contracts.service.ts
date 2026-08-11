import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Contract,
  ContractStatus,
  DocumentStatus,
  Prisma,
  Project,
  ProjectStatus,
} from '@prisma/client';
import {
  assertCompletedUploadLimits,
  sanitizeFileName,
} from '../documents/documents.types';
import { NotificationsService } from '../notifications/notifications.service';
import { platformSuccessFeeAmount } from '../notifications/platform-fees';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CONTRACT_ATTACHMENT_VERIFICATION_CATEGORIES } from '../verification/verification.types';
import { CommercialProposalService } from './commercial-proposal.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import {
  sanitizeContractBodyHtml,
  stripContractSignaturesBlock,
} from './contract-html.sanitize';
import {
  buildCustomContractStorageKey,
  CUSTOM_CONTRACT_ALLOWED_CONTENT_TYPES,
  isCustomContractStorageKeyForContract,
  MAX_CUSTOM_CONTRACT_BYTES,
  normalizeOptionalSignatureDataUrl,
  type CompleteCustomContractFileDto,
  type ContractResponse,
  type DownloadCustomContractDto,
  type PresignCustomContractFileDto,
  type SignContractDto,
  type UpdateContractDocumentDto,
} from './contracts.types';
import { DocxToPdfService } from '../pdf/docx-to-pdf.service';
import {
  buildZipBuffer,
  mapDualCustomFileMeta,
  normalizeDownloadFormats,
} from './custom-contract-files.util';
import { stampCustomPdfSignatures } from './custom-pdf-signatures.stamp';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_CONTENT_TYPE = 'application/pdf';

type ContractParticipant = {
  project: Project & {
    client?: { displayName: string | null; email: string | null } | null;
    tender: {
      currency: string;
      awardedBid: {
        contractorId: string;
        amount: Prisma.Decimal | null;
        contractor: {
          userId: string;
          companyName: string | null;
          user: { email: string | null };
        };
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
    private readonly storage: StorageService,
    private readonly docxToPdf: DocxToPdfService,
    @Inject(forwardRef(() => CommercialProposalService))
    private readonly commercialProposal: CommercialProposalService,
  ) {}

  private async toResponse(
    contract: Contract,
    project: Project,
    participant: Pick<ContractParticipant, 'isClient' | 'isSelectedContractor'>,
  ): Promise<ContractResponse> {
    const clientSigned = Boolean(contract.clientSignedAt);
    const contractorSigned = Boolean(contract.contractorSignedAt);
    const fullySigned = contract.status === ContractStatus.fully_signed;
    const hasCustomContract = Boolean(
      contract.customFileStorageKey || contract.sourceDocxStorageKey,
    );
    const canSign =
      project.status === ProjectStatus.awarded &&
      contract.status === ContractStatus.pending_signatures &&
      ((participant.isClient && !clientSigned) ||
        (participant.isSelectedContractor && !contractorSigned));
    const canEditDocument =
      !fullySigned &&
      !hasCustomContract &&
      project.status === ProjectStatus.awarded &&
      (participant.isClient || participant.isSelectedContractor);

    let signatureAuth: ContractResponse['signatureAuth'] = null;
    if (participant.isSelectedContractor) {
      const awardedProfile = await this.prisma.contractorProfile.findFirst({
        where: { bids: { some: { id: contract.bidId } } },
        select: { bankName: true, bankAccount: true },
      });
      const latestRequest =
        await this.prisma.contractSignatureRequest.findFirst({
          where: { projectId: project.id },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            rejectionReason: true,
            createdAt: true,
            reviewedAt: true,
          },
        });
      const bankName = awardedProfile?.bankName?.trim() || '';
      const bankAccount = awardedProfile?.bankAccount?.trim() || '';
      signatureAuth = {
        platformFeePaid: Boolean(project.platformFeePaid),
        hasBankDetails: Boolean(bankName && bankAccount),
        latestRequest: latestRequest
          ? {
              id: latestRequest.id,
              status: latestRequest.status,
              rejectionReason: latestRequest.rejectionReason,
              createdAt: latestRequest.createdAt.toISOString(),
              reviewedAt: latestRequest.reviewedAt?.toISOString() ?? null,
            }
          : null,
      };
    }

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
      clientSignatureDataUrl: contract.clientSignatureDataUrl,
      contractorSignatureDataUrl: contract.contractorSignatureDataUrl,
      englishBodyHtml: hasCustomContract
        ? null
        : contract.englishBodyHtml
          ? stripContractSignaturesBlock(contract.englishBodyHtml)
          : null,
      hasCustomContract,
      customFile: mapDualCustomFileMeta(contract),
      canSign,
      canEditDocument,
      fullySigned,
      signatureAuth,
    };
  }

  private assertEditableContract(contract: Contract, project: Project) {
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
  }

  private assertNoCustomFile(contract: Contract) {
    if (contract.customFileStorageKey || contract.sourceDocxStorageKey) {
      throw new BadRequestException(
        'A custom contract file is in use; the platform document cannot be edited',
      );
    }
  }

  private notifyOtherPartyOfContractChange(
    participant: ContractParticipant,
    projectId: string,
    kind: 'document' | 'custom_file',
  ) {
    const { project } = participant;
    const editorRole = participant.isClient ? 'client' : 'contractor';
    const contractorUserId =
      project.tender?.awardedBid?.contractor.userId ?? null;
    const recipientUserId =
      editorRole === 'client' ? contractorUserId : project.clientId;
    const recipientRole =
      editorRole === 'client' ? 'contractor' : 'client';

    if (!recipientUserId) {
      return;
    }

    if (kind === 'custom_file') {
      this.notifications.dispatch(
        this.notifications.notifyCustomContractFileUpdated({
          recipientUserId,
          recipientRole,
          editorRole,
          projectId,
          projectTitle: project.title,
        }),
      );
      return;
    }

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

  /** Best-effort S3 cleanup when award is reverted. */
  async deleteCustomFileObject(storageKey: string | null | undefined): Promise<void> {
    if (!storageKey) {
      return;
    }
    try {
      await this.storage.deleteObject(storageKey);
    } catch {
      // Orphaned object is acceptable; DB row is already gone.
    }
  }

  private async loadParticipant(
    userId: string,
    projectId: string,
  ): Promise<ContractParticipant> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: {
          select: { displayName: true, email: true },
        },
        tender: {
          include: {
            awardedBid: {
              include: {
                contractor: {
                  select: {
                    userId: true,
                    companyName: true,
                    user: { select: { email: true } },
                  },
                },
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

    if (!contract.englishBodyHtml?.trim() && !contract.customFileStorageKey) {
      contract = await this.ensureEnglishBodyHtml(contract);
    }

    return await this.toResponse(contract, participant.project, participant);
  }

  async getContractorDocumentDownloadUrl(
    userId: string,
    projectId: string,
    documentId: string,
  ): Promise<{
    downloadUrl: string;
    expiresInSeconds: number;
    originalName: string;
    contentType: string;
  }> {
    const participant = await this.loadParticipant(userId, projectId);
    const awardedContractorId =
      participant.project.tender?.awardedBid?.contractorId ?? null;
    if (!awardedContractorId) {
      throw new NotFoundException('Awarded contractor not found');
    }

    const doc = await this.prisma.contractorVerificationDocument.findFirst({
      where: {
        id: documentId,
        contractorId: awardedContractorId,
        status: DocumentStatus.uploaded,
        category: { in: CONTRACT_ATTACHMENT_VERIFICATION_CATEGORIES },
      },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    const presigned = await this.storage.createPresignedDownload(doc.storageKey);
    return {
      downloadUrl: presigned.downloadUrl,
      expiresInSeconds: presigned.expiresInSeconds,
      originalName: doc.originalName,
      contentType: doc.contentType,
    };
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

    this.assertEditableContract(contract, project);
    this.assertNoCustomFile(contract);

    let sanitized: string;
    try {
      sanitized = stripContractSignaturesBlock(
        sanitizeContractBodyHtml(dto.englishBodyHtml),
      );
    } catch (err: unknown) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid document content',
      );
    }

    const previousBody = (contract.englishBodyHtml ?? '').trim();
    if (previousBody === sanitized) {
      return await this.toResponse(contract, project, participant);
    }

    const hadSignatures = Boolean(
      contract.clientSignedAt || contract.contractorSignedAt,
    );

    const updated = await this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        englishBodyHtml: sanitized,
        ...(hadSignatures
          ? {
              status: ContractStatus.pending_signatures,
              clientSignedAt: null,
              contractorSignedAt: null,
              clientSignatureDataUrl: null,
              contractorSignatureDataUrl: null,
            }
          : {}),
      },
    });

    this.notifyOtherPartyOfContractChange(participant, projectId, 'document');

    return await this.toResponse(updated, project, participant);
  }

  async regenerateDocument(
    userId: string,
    projectId: string,
  ): Promise<ContractResponse> {
    const participant = await this.loadParticipant(userId, projectId);
    const { project } = participant;
    const contract = project.contract;

    if (!contract) {
      throw new NotFoundException('Contract not found for this project');
    }

    this.assertEditableContract(contract, project);

    const body = await this.commercialProposal.generateEnglishBodyHtml(
      contract.bidId,
    );
    const previousCustomKey = contract.customFileStorageKey;
    const previousDocxKey = contract.sourceDocxStorageKey;
    const hadCustomFile = Boolean(previousCustomKey || previousDocxKey);
    const hadSignatures = Boolean(
      contract.clientSignedAt || contract.contractorSignedAt,
    );
    const clearSignatures = hadCustomFile || hadSignatures;

    const updated = await this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        englishBodyHtml: body,
        customFileStorageKey: null,
        customFileOriginalName: null,
        customFileContentType: null,
        customFileSizeBytes: null,
        customFileUploadedByUserId: null,
        customFileUploadedAt: null,
        sourceDocxStorageKey: null,
        sourceDocxOriginalName: null,
        sourceDocxSizeBytes: null,
        ...(clearSignatures
          ? {
              status: ContractStatus.pending_signatures,
              clientSignedAt: null,
              contractorSignedAt: null,
              clientSignatureDataUrl: null,
              contractorSignatureDataUrl: null,
            }
          : {}),
      },
    });

    if (previousCustomKey) {
      await this.deleteCustomFileObject(previousCustomKey);
    }
    if (previousDocxKey) {
      await this.deleteCustomFileObject(previousDocxKey);
    }

    if (clearSignatures || hadCustomFile) {
      this.notifyOtherPartyOfContractChange(
        participant,
        projectId,
        'document',
      );
    }

    return await this.toResponse(updated, project, participant);
  }

  async presignCustomFile(
    userId: string,
    projectId: string,
    dto: PresignCustomContractFileDto,
  ): Promise<{
    uploadUrl: string;
    storageKey: string;
    expiresInSeconds: number;
  }> {
    const participant = await this.loadParticipant(userId, projectId);
    const { project } = participant;
    const contract = project.contract;

    if (!contract) {
      throw new NotFoundException('Contract not found for this project');
    }

    this.assertEditableContract(contract, project);

    const fileName = sanitizeFileName(dto.fileName?.trim() ?? '');
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }

    const contentType = dto.contentType?.trim().toLowerCase();
    if (
      !contentType ||
      !CUSTOM_CONTRACT_ALLOWED_CONTENT_TYPES.has(contentType)
    ) {
      throw new BadRequestException(
        'Only PDF and DOCX contract files are supported',
      );
    }

    if (
      !Number.isFinite(dto.sizeBytes) ||
      dto.sizeBytes < 1 ||
      dto.sizeBytes > MAX_CUSTOM_CONTRACT_BYTES
    ) {
      throw new BadRequestException(
        `File size must be between 1 byte and ${MAX_CUSTOM_CONTRACT_BYTES} bytes`,
      );
    }

    const storageKey = buildCustomContractStorageKey(
      projectId,
      contract.id,
      randomUUID(),
      fileName,
    );

    const presigned = await this.storage.createPresignedUpload({
      storageKey,
      contentType,
      sizeBytes: dto.sizeBytes,
    });

    return {
      uploadUrl: presigned.uploadUrl,
      storageKey: presigned.storageKey,
      expiresInSeconds: presigned.expiresInSeconds,
    };
  }

  async completeCustomFile(
    userId: string,
    projectId: string,
    dto: CompleteCustomContractFileDto,
  ): Promise<ContractResponse> {
    const participant = await this.loadParticipant(userId, projectId);
    const { project } = participant;
    const contract = project.contract;

    if (!contract) {
      throw new NotFoundException('Contract not found for this project');
    }

    this.assertEditableContract(contract, project);

    const storageKey = dto.storageKey?.trim();
    if (
      !storageKey ||
      !isCustomContractStorageKeyForContract(
        storageKey,
        projectId,
        contract.id,
      )
    ) {
      throw new BadRequestException('Invalid storage key');
    }

    const originalName = sanitizeFileName(dto.originalName?.trim() ?? '');
    if (!originalName) {
      throw new BadRequestException('originalName is required');
    }

    const declaredContentType = dto.contentType?.trim().toLowerCase();
    if (
      !declaredContentType ||
      !CUSTOM_CONTRACT_ALLOWED_CONTENT_TYPES.has(declaredContentType)
    ) {
      throw new BadRequestException(
        'Only PDF and DOCX contract files are supported',
      );
    }

    const { sizeBytes, contentType } =
      await this.storage.verifyObject(storageKey);
    assertCompletedUploadLimits({
      sizeBytes,
      contentType: contentType ?? declaredContentType,
      maxBytes: MAX_CUSTOM_CONTRACT_BYTES,
      allowedContentTypes: CUSTOM_CONTRACT_ALLOWED_CONTENT_TYPES,
    });

    let finalStorageKey = storageKey;
    let finalContentType = declaredContentType;
    let finalOriginalName = originalName;
    let finalSizeBytes = sizeBytes;
    let sourceDocxStorageKey: string | null = null;
    let sourceDocxOriginalName: string | null = null;
    let sourceDocxSizeBytes: number | null = null;
    const keysToDelete: string[] = [];

    if (declaredContentType === DOCX_CONTENT_TYPE) {
      const docxBuffer = await this.storage.getObjectBuffer(storageKey);
      const pdfBuffer = await this.docxToPdf.convert(docxBuffer);
      if (pdfBuffer.length > MAX_CUSTOM_CONTRACT_BYTES) {
        throw new BadRequestException(
          'Converted PDF exceeds the 25 MB upload limit',
        );
      }

      const pdfName = sanitizeFileName(
        originalName.replace(/\.docx$/i, '.pdf') || 'contract.pdf',
      );
      const pdfKey = buildCustomContractStorageKey(
        projectId,
        contract.id,
        randomUUID(),
        pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`,
      );
      await this.storage.putObject({
        storageKey: pdfKey,
        body: pdfBuffer,
        contentType: PDF_CONTENT_TYPE,
      });

      // Keep uploaded DOCX as editable source; PDF is for preview.
      sourceDocxStorageKey = storageKey;
      sourceDocxOriginalName = originalName;
      sourceDocxSizeBytes = sizeBytes;
      finalStorageKey = pdfKey;
      finalContentType = PDF_CONTENT_TYPE;
      finalOriginalName = pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`;
      finalSizeBytes = pdfBuffer.length;
    }

    const previousKey = contract.customFileStorageKey;
    const previousDocxKey = contract.sourceDocxStorageKey;
    const updated = await this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        customFileStorageKey: finalStorageKey,
        customFileOriginalName: finalOriginalName,
        customFileContentType: finalContentType,
        customFileSizeBytes: finalSizeBytes,
        customFileUploadedByUserId: userId,
        customFileUploadedAt: new Date(),
        sourceDocxStorageKey,
        sourceDocxOriginalName,
        sourceDocxSizeBytes,
        status: ContractStatus.pending_signatures,
        clientSignedAt: null,
        contractorSignedAt: null,
        clientSignatureDataUrl: null,
        contractorSignatureDataUrl: null,
      },
    });

    if (previousKey && previousKey !== finalStorageKey) {
      keysToDelete.push(previousKey);
    }
    if (
      previousDocxKey &&
      previousDocxKey !== sourceDocxStorageKey &&
      previousDocxKey !== finalStorageKey
    ) {
      keysToDelete.push(previousDocxKey);
    }
    for (const key of keysToDelete) {
      if (key !== finalStorageKey && key !== sourceDocxStorageKey) {
        await this.deleteCustomFileObject(key);
      }
    }

    this.notifyOtherPartyOfContractChange(participant, projectId, 'custom_file');

    return await this.toResponse(updated, project, participant);
  }

  /**
   * Presigned URL for the preview file (PDF when available).
   */
  async getCustomFileDownloadUrl(
    userId: string,
    projectId: string,
  ): Promise<{
    downloadUrl: string;
    expiresInSeconds: number;
    originalName: string;
    contentType: string;
  }> {
    const participant = await this.loadParticipant(userId, projectId);
    const contract = participant.project.contract;

    if (!contract?.customFileStorageKey && !contract?.sourceDocxStorageKey) {
      throw new NotFoundException('Custom contract file not found');
    }

    const storageKey =
      contract.customFileStorageKey ?? contract.sourceDocxStorageKey!;
    const originalName = contract.customFileStorageKey
      ? (contract.customFileOriginalName ?? 'contract.pdf')
      : (contract.sourceDocxOriginalName ?? 'contract.docx');
    const contentType = contract.customFileStorageKey
      ? (contract.customFileContentType ?? PDF_CONTENT_TYPE)
      : DOCX_CONTENT_TYPE;

    const presigned = await this.storage.createPresignedDownload(storageKey);
    return {
      downloadUrl: presigned.downloadUrl,
      expiresInSeconds: presigned.expiresInSeconds,
      originalName,
      contentType,
    };
  }

  async downloadCustomFile(
    userId: string,
    projectId: string,
    dto: DownloadCustomContractDto,
  ): Promise<{
    buffer: Buffer;
    fileName: string;
    contentType: string;
  }> {
    const participant = await this.loadParticipant(userId, projectId);
    const contract = participant.project.contract;
    if (!contract) {
      throw new NotFoundException('Contract not found for this project');
    }

    const meta = mapDualCustomFileMeta(contract);
    if (!meta) {
      throw new NotFoundException('Custom contract file not found');
    }

    const formats = normalizeDownloadFormats(dto.formats);
    if (formats.length === 0) {
      throw new BadRequestException('Select at least one format: pdf or docx');
    }
    for (const format of formats) {
      if (format === 'pdf' && !meta.hasPdf) {
        throw new BadRequestException('PDF is not available for this contract');
      }
      if (format === 'docx' && !meta.hasDocx) {
        throw new BadRequestException('DOCX is not available for this contract');
      }
    }

    const includeSignatures = dto.includeSignatures === true;
    const client = participant.project.client;
    const contractor = participant.project.tender?.awardedBid?.contractor;

    const entries: Array<{ name: string; buffer: Buffer }> = [];
    for (const format of formats) {
      if (format === 'pdf') {
        if (!contract.customFileStorageKey) {
          throw new NotFoundException('PDF file not found');
        }
        let buffer = await this.storage.getObjectBuffer(
          contract.customFileStorageKey,
        );
        if (includeSignatures) {
          buffer = await stampCustomPdfSignatures({
            pdfBuffer: buffer,
            left: {
              label: 'Client',
              orgName: client?.displayName || client?.email || null,
              signedAt: contract.clientSignedAt,
              signatureDataUrl: contract.clientSignatureDataUrl,
            },
            right: {
              label: 'Contractor',
              orgName: contractor?.companyName || null,
              signedAt: contract.contractorSignedAt,
              signatureDataUrl: contract.contractorSignatureDataUrl,
            },
          });
        }
        entries.push({
          name: meta.pdfOriginalName || 'contract.pdf',
          buffer,
        });
      } else {
        const key =
          contract.sourceDocxStorageKey ??
          (meta.hasDocx ? contract.customFileStorageKey : null);
        if (!key) {
          throw new NotFoundException('DOCX file not found');
        }
        entries.push({
          name: meta.docxOriginalName || 'contract.docx',
          buffer: await this.storage.getObjectBuffer(key),
        });
      }
    }

    if (entries.length === 1) {
      const only = entries[0]!;
      const isPdf = only.name.toLowerCase().endsWith('.pdf');
      return {
        buffer: only.buffer,
        fileName: only.name,
        contentType: isPdf ? PDF_CONTENT_TYPE : DOCX_CONTENT_TYPE,
      };
    }

    const zip = await buildZipBuffer(entries);
    return {
      buffer: zip,
      fileName: 'contract-files.zip',
      contentType: 'application/zip',
    };
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
      return await this.toResponse(contract, project, participant);
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

    if (isSelectedContractor && !project.platformFeePaid) {
      throw new ForbiddenException(
        'Signature authorization is required before signing. Submit a request from the contract page.',
      );
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

    const response = await this.toResponse(updated, refreshedProject, participant);

    if (updated.status === ContractStatus.fully_signed) {
      const awardedBid = project.tender?.awardedBid ?? null;
      const contractorUserId = awardedBid?.contractor.userId ?? null;
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

      const contractAmount =
        awardedBid?.amount != null ? Number(awardedBid.amount) : null;
      const feeAmount =
        contractAmount != null && Number.isFinite(contractAmount)
          ? platformSuccessFeeAmount(contractAmount)
          : null;
      this.notifications.dispatch(
        this.notifications.notifyAdminPlatformFeeInvoice({
          projectId,
          projectTitle: project.title,
          contractorCompanyName: awardedBid?.contractor.companyName ?? null,
          contractorEmail: awardedBid?.contractor.user.email ?? null,
          contractAmount:
            contractAmount != null && Number.isFinite(contractAmount)
              ? contractAmount
              : null,
          currency: project.tender?.currency ?? 'THB',
          feeAmount,
        }),
      );
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
