import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PassThrough } from 'stream';
import { ZipArchive } from 'archiver';
import {
  ContractAddendum,
  ContractAddendumAttachment,
  ContractAddendumStatus,
  ContractStatus,
  DocumentStatus,
  ProjectStatus,
} from '@prisma/client';
import { OpenAiContractAddendumService } from '../ai/openai-contract-addendum.service';
import {
  assertCompletedUploadLimits,
  sanitizeFileName,
} from '../documents/documents.types';
import { NotificationsService } from '../notifications/notifications.service';
import { DocxToPdfService } from '../pdf/docx-to-pdf.service';
import { HtmlToPdfService } from '../pdf/html-to-pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { sanitizeContractBodyHtml } from './contract-html.sanitize';
import {
  ADDENDUM_ALLOWED_CONTENT_TYPES,
  ADDENDUM_ATTACHMENT_CONTENT_TYPES,
  buildAddendumAttachmentStorageKey,
  buildAddendumStorageKey,
  CreateAddendumFromFileDto,
  CreateAddendumFromTextDto,
  ContractAddendumAttachmentResponse,
  ContractAddendumResponse,
  fallbackAddendumHtml,
  isAddendumStorageKey,
  MAX_ADDENDUM_ATTACHMENTS,
  MAX_ADDENDUM_ATTACHMENT_BYTES,
  MAX_ADDENDUM_FILE_BYTES,
  normalizeOptionalSignatureDataUrl,
  parseAddendumLocale,
  PresignAddendumAttachmentDto,
  PresignAddendumFileDto,
  RegenerateAddendumDto,
  SignAddendumDto,
  UpdateAddendumDocumentDto,
} from './contract-addenda.types';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_CONTENT_TYPE = 'application/pdf';

type Participant = {
  projectId: string;
  contractId: string;
  projectTitle: string;
  clientUserId: string;
  contractorUserId: string;
  isClient: boolean;
  isSelectedContractor: boolean;
  contractEnglishBodyHtml: string | null;
};

type AddendumWithAttachments = ContractAddendum & {
  attachments?: ContractAddendumAttachment[];
};

interface ZipEntry {
  name: string;
  buffer: Buffer;
}

function sanitizeZipEntryName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'file';
}

function uniqueZipName(baseName: string, used: Set<string>): string {
  let candidate = baseName;
  let index = 2;
  while (used.has(candidate)) {
    const dot = baseName.lastIndexOf('.');
    if (dot > 0) {
      candidate = `${baseName.slice(0, dot)}-${index}${baseName.slice(dot)}`;
    } else {
      candidate = `${baseName}-${index}`;
    }
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

async function buildZipBuffer(entries: ZipEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    archive.on('error', reject);
    archive.pipe(stream);

    for (const entry of entries) {
      archive.append(entry.buffer, { name: entry.name });
    }

    void archive.finalize();
  });
}

function wrapAddendumHtmlForPdf(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title.replace(/</g, '&lt;')}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; font-size: 12pt; line-height: 1.45; color: #111; }
  h2, h3 { margin: 1.1em 0 0.4em; }
  p { margin: 0.55em 0; }
  table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
  th, td { border: 1px solid #333; padding: 6px 8px; vertical-align: top; }
  ul, ol { margin: 0.5em 0 0.5em 1.25em; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

@Injectable()
export class ContractAddendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly docxToPdf: DocxToPdfService,
    private readonly htmlToPdf: HtmlToPdfService,
    private readonly addendumAi: OpenAiContractAddendumService,
  ) {}

  private mapAttachment(
    row: ContractAddendumAttachment,
  ): ContractAddendumAttachmentResponse {
    return {
      id: row.id,
      originalName: row.originalName,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      uploadedAt: row.uploadedAt?.toISOString() ?? null,
    };
  }

  private toResponse(
    row: AddendumWithAttachments,
    participant: Pick<Participant, 'isClient' | 'isSelectedContractor'>,
  ): ContractAddendumResponse {
    const fullySigned = row.status === ContractAddendumStatus.fully_signed;
    const hasCustomFile = Boolean(row.customFileStorageKey);
    const canSign =
      !fullySigned &&
      ((participant.isSelectedContractor && !row.contractorSignedAt) ||
        (participant.isClient &&
          Boolean(row.contractorSignedAt) &&
          !row.clientSignedAt));
    const canEditDocument =
      !fullySigned &&
      !hasCustomFile &&
      (participant.isClient || participant.isSelectedContractor);
    const canReplaceFile =
      !fullySigned &&
      (participant.isClient || participant.isSelectedContractor);
    const canManageAttachments =
      !fullySigned &&
      (participant.isClient || participant.isSelectedContractor);
    const attachments = (row.attachments ?? [])
      .filter((item) => item.status !== DocumentStatus.deleted)
      .map((item) => this.mapAttachment(item));

    return {
      id: row.id,
      contractId: row.contractId,
      projectId: row.projectId,
      title: row.title,
      sourceDescription: row.sourceDescription,
      englishBodyHtml: hasCustomFile ? null : row.englishBodyHtml,
      bodyLocale: parseAddendumLocale(row.bodyLocale),
      status: row.status,
      contractorSignedAt: row.contractorSignedAt?.toISOString() ?? null,
      clientSignedAt: row.clientSignedAt?.toISOString() ?? null,
      hasContractorSignature: Boolean(row.contractorSignatureDataUrl),
      hasClientSignature: Boolean(row.clientSignatureDataUrl),
      contractorSignatureDataUrl: row.contractorSignatureDataUrl,
      clientSignatureDataUrl: row.clientSignatureDataUrl,
      hasCustomFile,
      customFile:
        hasCustomFile &&
        row.customFileOriginalName &&
        row.customFileContentType &&
        row.customFileUploadedAt
          ? {
              originalName: row.customFileOriginalName,
              contentType: row.customFileContentType,
              sizeBytes: row.customFileSizeBytes,
              uploadedAt: row.customFileUploadedAt.toISOString(),
            }
          : null,
      attachments,
      canEditDocument,
      canReplaceFile,
      canManageAttachments,
      canSign,
      fullySigned,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async loadParticipant(
    userId: string,
    projectId: string,
  ): Promise<Participant> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        contract: true,
        tender: {
          include: {
            awardedBid: {
              include: { contractor: { select: { userId: true } } },
            },
          },
        },
      },
    });
    if (!project?.contract) {
      throw new NotFoundException('Contract not found for this project');
    }
    if (project.contract.status !== ContractStatus.fully_signed) {
      throw new BadRequestException(
        'Additional agreements are only available after the main contract is fully signed',
      );
    }
    if (project.status !== ProjectStatus.active) {
      throw new BadRequestException(
        'Additional agreements are only available while the project is active',
      );
    }

    const contractorUserId = project.tender?.awardedBid?.contractor.userId;
    if (!contractorUserId) {
      throw new BadRequestException('Awarded contractor not found');
    }

    const isClient = project.clientId === userId;
    const isSelectedContractor = contractorUserId === userId;
    if (!isClient && !isSelectedContractor) {
      throw new ForbiddenException('Not a party to this contract');
    }

    return {
      projectId: project.id,
      contractId: project.contract.id,
      projectTitle: project.title,
      clientUserId: project.clientId,
      contractorUserId,
      isClient,
      isSelectedContractor,
      contractEnglishBodyHtml: project.contract.englishBodyHtml,
    };
  }

  async list(userId: string, projectId: string): Promise<ContractAddendumResponse[]> {
    const participant = await this.loadParticipant(userId, projectId);
    const rows = await this.prisma.contractAddendum.findMany({
      where: { contractId: participant.contractId },
      orderBy: { createdAt: 'desc' },
      include: {
        attachments: {
          where: { status: { not: DocumentStatus.deleted } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return rows.map((row) => this.toResponse(row, participant));
  }

  async get(
    userId: string,
    projectId: string,
    addendumId: string,
  ): Promise<ContractAddendumResponse> {
    const participant = await this.loadParticipant(userId, projectId);
    const row = await this.prisma.contractAddendum.findFirst({
      where: { id: addendumId, contractId: participant.contractId },
      include: {
        attachments: {
          where: { status: { not: DocumentStatus.deleted } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Additional agreement not found');
    return this.toResponse(row, participant);
  }

  async createFromText(
    userId: string,
    projectId: string,
    dto: CreateAddendumFromTextDto,
  ): Promise<ContractAddendumResponse> {
    const participant = await this.loadParticipant(userId, projectId);
    const description = dto.description?.trim();
    if (!description || description.length < 10) {
      throw new BadRequestException(
        'Describe the additional agreement (at least 10 characters)',
      );
    }

    const locale = parseAddendumLocale(dto.locale);
    const count = await this.prisma.contractAddendum.count({
      where: { contractId: participant.contractId },
    });
    const aiTitle = dto.title?.trim()
      ? null
      : await this.addendumAi.generateTitle(description, locale);
    const title =
      dto.title?.trim() ||
      aiTitle ||
      `Additional agreement #${count + 1}`;

    let html = await this.addendumAi.generateBodyHtml({
      projectTitle: participant.projectTitle,
      contractExcerptHtml: participant.contractEnglishBodyHtml,
      description,
      locale,
    });
    if (!html) {
      html = fallbackAddendumHtml(description, title, locale);
    }
    html = sanitizeContractBodyHtml(html);

    const row = await this.prisma.contractAddendum.create({
      data: {
        contractId: participant.contractId,
        projectId: participant.projectId,
        createdById: userId,
        title,
        sourceDescription: description,
        englishBodyHtml: html,
        bodyLocale: locale,
        status: ContractAddendumStatus.pending_signatures,
      },
      include: {
        attachments: {
          where: { status: { not: DocumentStatus.deleted } },
        },
      },
    });

    await this.notifyCreated(participant, userId, row.id, title);
    return this.toResponse(row, participant);
  }

  async createFromFile(
    userId: string,
    projectId: string,
    dto: CreateAddendumFromFileDto,
  ): Promise<ContractAddendumResponse> {
    const participant = await this.loadParticipant(userId, projectId);
    const count = await this.prisma.contractAddendum.count({
      where: { contractId: participant.contractId },
    });
    const title =
      dto.title?.trim() || `Additional agreement #${count + 1}`;

    const addendumId = dto.addendumId?.trim();
    if (!addendumId) {
      throw new BadRequestException('addendumId from presign is required');
    }
    const exists = await this.prisma.contractAddendum.findUnique({
      where: { id: addendumId },
    });
    if (exists) {
      throw new BadRequestException('Addendum id already used');
    }

    const {
      storageKey,
      originalName,
      contentType,
      sizeBytes,
    } = await this.finalizeUploadedFile({
      projectId,
      addendumId,
      dto,
    });

    const row = await this.prisma.contractAddendum.create({
      data: {
        id: addendumId,
        contractId: participant.contractId,
        projectId: participant.projectId,
        createdById: userId,
        title,
        englishBodyHtml: null,
        customFileStorageKey: storageKey,
        customFileOriginalName: originalName,
        customFileContentType: contentType,
        customFileSizeBytes: sizeBytes,
        customFileUploadedByUserId: userId,
        customFileUploadedAt: new Date(),
        status: ContractAddendumStatus.pending_signatures,
      },
      include: {
        attachments: {
          where: { status: { not: DocumentStatus.deleted } },
        },
      },
    });

    await this.notifyCreated(participant, userId, row.id, title);
    return this.toResponse(row, participant);
  }

  /**
   * Presign for a not-yet-created addendum: allocates id up front.
   */
  async presignCreateFile(
    userId: string,
    projectId: string,
    dto: PresignAddendumFileDto,
  ) {
    await this.loadParticipant(userId, projectId);
    const fileName = sanitizeFileName(dto.fileName?.trim() ?? '');
    if (!fileName) throw new BadRequestException('fileName is required');
    const contentType = dto.contentType?.trim().toLowerCase();
    if (!contentType || !ADDENDUM_ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException('Only PDF and DOCX files are supported');
    }
    if (
      !Number.isFinite(dto.sizeBytes) ||
      dto.sizeBytes < 1 ||
      dto.sizeBytes > MAX_ADDENDUM_FILE_BYTES
    ) {
      throw new BadRequestException('Invalid file size');
    }

    const addendumId = randomUUID();
    const storageKey = buildAddendumStorageKey(
      projectId,
      addendumId,
      randomUUID(),
      fileName,
    );
    const presigned = await this.storage.createPresignedUpload({
      storageKey,
      contentType,
      sizeBytes: dto.sizeBytes,
    });
    return {
      addendumId,
      uploadUrl: presigned.uploadUrl,
      storageKey: presigned.storageKey,
      expiresInSeconds: presigned.expiresInSeconds,
    };
  }

  async updateDocument(
    userId: string,
    projectId: string,
    addendumId: string,
    dto: UpdateAddendumDocumentDto,
  ): Promise<ContractAddendumResponse> {
    const participant = await this.loadParticipant(userId, projectId);
    const row = await this.requireEditableAddendum(
      participant,
      addendumId,
      'document',
    );
    if (row.customFileStorageKey) {
      throw new BadRequestException(
        'A custom file is in use; the platform document cannot be edited',
      );
    }
    const html = sanitizeContractBodyHtml(dto.englishBodyHtml ?? '');
    const updated = await this.prisma.contractAddendum.update({
      where: { id: row.id },
      data: {
        englishBodyHtml: html,
        contractorSignedAt: null,
        clientSignedAt: null,
        contractorSignatureDataUrl: null,
        clientSignatureDataUrl: null,
        status: ContractAddendumStatus.pending_signatures,
      },
      include: {
        attachments: {
          where: { status: { not: DocumentStatus.deleted } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return this.toResponse(updated, participant);
  }

  async regenerateFromDescription(
    userId: string,
    projectId: string,
    addendumId: string,
    dto?: RegenerateAddendumDto,
  ): Promise<ContractAddendumResponse> {
    const participant = await this.loadParticipant(userId, projectId);
    const row = await this.requireEditableAddendum(
      participant,
      addendumId,
      'document',
    );
    if (!row.sourceDescription?.trim()) {
      throw new BadRequestException(
        'No source description to regenerate from (file-based addendum)',
      );
    }

    const locale = parseAddendumLocale(dto?.locale ?? row.bodyLocale);
    let html = await this.addendumAi.generateBodyHtml({
      projectTitle: participant.projectTitle,
      contractExcerptHtml: participant.contractEnglishBodyHtml,
      description: row.sourceDescription,
      locale,
    });
    if (!html) {
      html = fallbackAddendumHtml(row.sourceDescription, row.title, locale);
    }
    html = sanitizeContractBodyHtml(html);

    const previousKey = row.customFileStorageKey;
    const updated = await this.prisma.contractAddendum.update({
      where: { id: row.id },
      data: {
        englishBodyHtml: html,
        bodyLocale: locale,
        customFileStorageKey: null,
        customFileOriginalName: null,
        customFileContentType: null,
        customFileSizeBytes: null,
        customFileUploadedByUserId: null,
        customFileUploadedAt: null,
        contractorSignedAt: null,
        clientSignedAt: null,
        contractorSignatureDataUrl: null,
        clientSignatureDataUrl: null,
        status: ContractAddendumStatus.pending_signatures,
      },
      include: {
        attachments: {
          where: { status: { not: DocumentStatus.deleted } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (previousKey) {
      await this.storage.deleteObject(previousKey).catch(() => undefined);
    }
    return this.toResponse(updated, participant);
  }

  async presignReplaceFile(
    userId: string,
    projectId: string,
    addendumId: string,
    dto: PresignAddendumFileDto,
  ) {
    const participant = await this.loadParticipant(userId, projectId);
    await this.requireEditableAddendum(participant, addendumId, 'file');
    const fileName = sanitizeFileName(dto.fileName?.trim() ?? '');
    if (!fileName) throw new BadRequestException('fileName is required');
    const contentType = dto.contentType?.trim().toLowerCase();
    if (!contentType || !ADDENDUM_ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException('Only PDF and DOCX files are supported');
    }
    if (
      !Number.isFinite(dto.sizeBytes) ||
      dto.sizeBytes < 1 ||
      dto.sizeBytes > MAX_ADDENDUM_FILE_BYTES
    ) {
      throw new BadRequestException('Invalid file size');
    }
    const storageKey = buildAddendumStorageKey(
      projectId,
      addendumId,
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

  async completeReplaceFile(
    userId: string,
    projectId: string,
    addendumId: string,
    dto: CreateAddendumFromFileDto,
  ): Promise<ContractAddendumResponse> {
    const participant = await this.loadParticipant(userId, projectId);
    const row = await this.requireEditableAddendum(participant, addendumId, 'file');
    const finalized = await this.finalizeUploadedFile({
      projectId,
      addendumId,
      dto,
    });
    const previousKey = row.customFileStorageKey;
    const updated = await this.prisma.contractAddendum.update({
      where: { id: row.id },
      data: {
        englishBodyHtml: null,
        customFileStorageKey: finalized.storageKey,
        customFileOriginalName: finalized.originalName,
        customFileContentType: finalized.contentType,
        customFileSizeBytes: finalized.sizeBytes,
        customFileUploadedByUserId: userId,
        customFileUploadedAt: new Date(),
        contractorSignedAt: null,
        clientSignedAt: null,
        contractorSignatureDataUrl: null,
        clientSignatureDataUrl: null,
        status: ContractAddendumStatus.pending_signatures,
      },
      include: {
        attachments: {
          where: { status: { not: DocumentStatus.deleted } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (previousKey && previousKey !== finalized.storageKey) {
      await this.storage.deleteObject(previousKey).catch(() => undefined);
    }
    return this.toResponse(updated, participant);
  }

  async getFileDownloadUrl(
    userId: string,
    projectId: string,
    addendumId: string,
  ) {
    const participant = await this.loadParticipant(userId, projectId);
    const row = await this.prisma.contractAddendum.findFirst({
      where: { id: addendumId, contractId: participant.contractId },
    });
    if (!row?.customFileStorageKey) {
      throw new NotFoundException('Custom addendum file not found');
    }
    const presigned = await this.storage.createPresignedDownload(
      row.customFileStorageKey,
    );
    return {
      downloadUrl: presigned.downloadUrl,
      expiresInSeconds: presigned.expiresInSeconds,
      originalName: row.customFileOriginalName ?? 'addendum',
      contentType: row.customFileContentType ?? 'application/octet-stream',
    };
  }

  async sign(
    userId: string,
    projectId: string,
    addendumId: string,
    dto: SignAddendumDto,
  ): Promise<ContractAddendumResponse> {
    const participant = await this.loadParticipant(userId, projectId);
    const row = await this.prisma.contractAddendum.findFirst({
      where: { id: addendumId, contractId: participant.contractId },
    });
    if (!row) throw new NotFoundException('Additional agreement not found');
    if (row.status === ContractAddendumStatus.fully_signed) {
      return this.toResponse(row, participant);
    }

    if (participant.isClient && !row.contractorSignedAt) {
      throw new BadRequestException(
        'The contractor must sign this additional agreement first',
      );
    }

    if (participant.isSelectedContractor && row.contractorSignedAt) {
      throw new BadRequestException('You have already signed');
    }
    if (participant.isClient && row.clientSignedAt) {
      throw new BadRequestException('You have already signed');
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
    const data =
      participant.isSelectedContractor
        ? {
            contractorSignedAt: now,
            ...(signatureDataUrl
              ? { contractorSignatureDataUrl: signatureDataUrl }
              : {}),
          }
        : {
            clientSignedAt: now,
            ...(signatureDataUrl
              ? { clientSignatureDataUrl: signatureDataUrl }
              : {}),
          };

    const otherSigned = participant.isSelectedContractor
      ? Boolean(row.clientSignedAt)
      : Boolean(row.contractorSignedAt);

    const updated = await this.prisma.contractAddendum.update({
      where: { id: row.id },
      data: {
        ...data,
        ...(otherSigned
          ? { status: ContractAddendumStatus.fully_signed }
          : {}),
      },
      include: {
        attachments: {
          where: { status: { not: DocumentStatus.deleted } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const otherUserId = participant.isSelectedContractor
      ? participant.clientUserId
      : participant.contractorUserId;

    if (updated.status === ContractAddendumStatus.fully_signed) {
      this.notifications.dispatch(
        this.notifications.notifyContractAddendumFullySigned({
          clientUserId: participant.clientUserId,
          contractorUserId: participant.contractorUserId,
          projectId: participant.projectId,
          projectTitle: participant.projectTitle,
          addendumTitle: updated.title,
        }),
      );
    } else {
      this.notifications.dispatch(
        this.notifications.notifyContractAddendumPartySigned({
          recipientUserId: otherUserId,
          signerRole: participant.isSelectedContractor
            ? 'contractor'
            : 'client',
          projectId: participant.projectId,
          projectTitle: participant.projectTitle,
          addendumTitle: updated.title,
        }),
      );
    }

    return this.toResponse(updated, participant);
  }

  async presignAttachment(
    userId: string,
    projectId: string,
    addendumId: string,
    dto: PresignAddendumAttachmentDto,
  ) {
    const participant = await this.loadParticipant(userId, projectId);
    const row = await this.requireEditableAddendum(
      participant,
      addendumId,
      'file',
    );
    const fileName = sanitizeFileName(dto.fileName?.trim() ?? '');
    if (!fileName) throw new BadRequestException('fileName is required');
    const contentType = dto.contentType?.trim().toLowerCase();
    if (!contentType || !ADDENDUM_ATTACHMENT_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException('Unsupported attachment type');
    }
    if (
      !Number.isFinite(dto.sizeBytes) ||
      dto.sizeBytes < 1 ||
      dto.sizeBytes > MAX_ADDENDUM_ATTACHMENT_BYTES
    ) {
      throw new BadRequestException('Invalid file size');
    }

    const activeCount = await this.prisma.contractAddendumAttachment.count({
      where: {
        addendumId: row.id,
        status: { in: [DocumentStatus.uploaded, DocumentStatus.pending] },
      },
    });
    if (activeCount >= MAX_ADDENDUM_ATTACHMENTS) {
      throw new BadRequestException(
        `At most ${MAX_ADDENDUM_ATTACHMENTS} attachments per additional agreement`,
      );
    }

    const attachmentId = randomUUID();
    const storageKey = buildAddendumAttachmentStorageKey(
      projectId,
      addendumId,
      attachmentId,
      fileName,
    );
    await this.prisma.contractAddendumAttachment.create({
      data: {
        id: attachmentId,
        addendumId: row.id,
        uploaderId: userId,
        originalName: fileName,
        contentType,
        sizeBytes: dto.sizeBytes,
        storageKey,
        status: DocumentStatus.pending,
      },
    });
    const presigned = await this.storage.createPresignedUpload({
      storageKey,
      contentType,
      sizeBytes: dto.sizeBytes,
    });
    return {
      attachmentId,
      uploadUrl: presigned.uploadUrl,
      storageKey: presigned.storageKey,
      expiresInSeconds: presigned.expiresInSeconds,
    };
  }

  async completeAttachment(
    userId: string,
    projectId: string,
    addendumId: string,
    attachmentId: string,
  ): Promise<ContractAddendumAttachmentResponse> {
    const participant = await this.loadParticipant(userId, projectId);
    await this.requireEditableAddendum(participant, addendumId, 'file');
    const attachment = await this.prisma.contractAddendumAttachment.findFirst({
      where: { id: attachmentId, addendumId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.status === DocumentStatus.uploaded) {
      return this.mapAttachment(attachment);
    }
    if (attachment.status === DocumentStatus.deleted) {
      throw new BadRequestException('Attachment was deleted');
    }

    const { sizeBytes, contentType } = await this.storage.verifyObject(
      attachment.storageKey,
    );
    assertCompletedUploadLimits({
      sizeBytes,
      contentType: contentType ?? attachment.contentType,
      maxBytes: MAX_ADDENDUM_ATTACHMENT_BYTES,
      allowedContentTypes: ADDENDUM_ATTACHMENT_CONTENT_TYPES,
    });

    const updated = await this.prisma.contractAddendumAttachment.update({
      where: { id: attachmentId },
      data: {
        status: DocumentStatus.uploaded,
        sizeBytes,
        uploadedAt: new Date(),
      },
    });
    return this.mapAttachment(updated);
  }

  async deleteAttachment(
    userId: string,
    projectId: string,
    addendumId: string,
    attachmentId: string,
  ): Promise<void> {
    const participant = await this.loadParticipant(userId, projectId);
    await this.requireEditableAddendum(participant, addendumId, 'file');
    const attachment = await this.prisma.contractAddendumAttachment.findFirst({
      where: { id: attachmentId, addendumId },
    });
    if (!attachment || attachment.status === DocumentStatus.deleted) {
      throw new NotFoundException('Attachment not found');
    }
    await this.prisma.contractAddendumAttachment.update({
      where: { id: attachmentId },
      data: { status: DocumentStatus.deleted },
    });
    await this.storage.deleteObject(attachment.storageKey).catch(() => undefined);
  }

  async getAttachmentDownloadUrl(
    userId: string,
    projectId: string,
    addendumId: string,
    attachmentId: string,
  ) {
    const participant = await this.loadParticipant(userId, projectId);
    const row = await this.prisma.contractAddendum.findFirst({
      where: { id: addendumId, contractId: participant.contractId },
    });
    if (!row) throw new NotFoundException('Additional agreement not found');
    const attachment = await this.prisma.contractAddendumAttachment.findFirst({
      where: {
        id: attachmentId,
        addendumId,
        status: DocumentStatus.uploaded,
      },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    const presigned = await this.storage.createPresignedDownload(
      attachment.storageKey,
    );
    return {
      downloadUrl: presigned.downloadUrl,
      expiresInSeconds: presigned.expiresInSeconds,
      originalName: attachment.originalName,
      contentType: attachment.contentType,
    };
  }

  async renderDownload(
    userId: string,
    projectId: string,
    addendumId: string,
    options: { withAttachments: boolean },
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    const participant = await this.loadParticipant(userId, projectId);
    const row = await this.prisma.contractAddendum.findFirst({
      where: { id: addendumId, contractId: participant.contractId },
      include: {
        attachments: {
          where: { status: DocumentStatus.uploaded },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Additional agreement not found');

    const slug =
      row.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'addendum';
    const mainDoc = await this.buildMainDocumentBuffer(row);
    const attachments = row.attachments ?? [];
    const includeAttachments =
      options.withAttachments && attachments.length > 0;

    if (!includeAttachments) {
      return {
        buffer: mainDoc.buffer,
        fileName: mainDoc.fileName || `${slug}.pdf`,
        contentType: mainDoc.contentType,
      };
    }

    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException(
        'File storage is not configured. Cannot bundle attachments.',
      );
    }

    const usedNames = new Set<string>();
    const entries: ZipEntry[] = [
      {
        name: uniqueZipName(mainDoc.fileName || `${slug}.pdf`, usedNames),
        buffer: mainDoc.buffer,
      },
    ];

    for (const attachment of attachments) {
      try {
        const buffer = await this.storage.getObjectBuffer(attachment.storageKey);
        entries.push({
          name: uniqueZipName(
            `attachments/${sanitizeZipEntryName(attachment.originalName)}`,
            usedNames,
          ),
          buffer,
        });
      } catch {
        // Skip missing objects
      }
    }

    const zip = await buildZipBuffer(entries);
    return {
      buffer: zip,
      fileName: `${slug}-with-attachments.zip`,
      contentType: 'application/zip',
    };
  }

  private async buildMainDocumentBuffer(row: ContractAddendum): Promise<{
    buffer: Buffer;
    fileName: string;
    contentType: string;
  }> {
    if (row.customFileStorageKey) {
      const buffer = await this.storage.getObjectBuffer(row.customFileStorageKey);
      const originalName = row.customFileOriginalName || 'addendum.pdf';
      return {
        buffer,
        fileName: sanitizeZipEntryName(originalName),
        contentType: row.customFileContentType || 'application/octet-stream',
      };
    }
    if (!row.englishBodyHtml?.trim()) {
      throw new BadRequestException('Additional agreement has no document body');
    }
    const html = wrapAddendumHtmlForPdf(row.title, row.englishBodyHtml);
    const pdf = await this.htmlToPdf.render(html);
    const slug =
      row.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'addendum';
    return {
      buffer: pdf,
      fileName: `${slug}.pdf`,
      contentType: 'application/pdf',
    };
  }

  private async requireEditableAddendum(
    participant: Participant,
    addendumId: string,
    _kind: 'document' | 'file',
  ): Promise<ContractAddendum> {
    const row = await this.prisma.contractAddendum.findFirst({
      where: { id: addendumId, contractId: participant.contractId },
    });
    if (!row) throw new NotFoundException('Additional agreement not found');
    if (row.status === ContractAddendumStatus.fully_signed) {
      throw new BadRequestException(
        'Fully signed additional agreements cannot be changed',
      );
    }
    return row;
  }

  private async finalizeUploadedFile(params: {
    projectId: string;
    addendumId: string;
    dto: CreateAddendumFromFileDto;
  }): Promise<{
    storageKey: string;
    originalName: string;
    contentType: string;
    sizeBytes: number;
  }> {
    const storageKey = params.dto.storageKey?.trim();
    if (
      !storageKey ||
      !isAddendumStorageKey(storageKey, params.projectId, params.addendumId)
    ) {
      throw new BadRequestException('Invalid storage key');
    }
    const originalName = sanitizeFileName(params.dto.originalName?.trim() ?? '');
    if (!originalName) {
      throw new BadRequestException('originalName is required');
    }
    const declaredContentType = params.dto.contentType?.trim().toLowerCase();
    if (
      !declaredContentType ||
      !ADDENDUM_ALLOWED_CONTENT_TYPES.has(declaredContentType)
    ) {
      throw new BadRequestException('Only PDF and DOCX files are supported');
    }

    const { sizeBytes, contentType } =
      await this.storage.verifyObject(storageKey);
    assertCompletedUploadLimits({
      sizeBytes,
      contentType: contentType ?? declaredContentType,
      maxBytes: MAX_ADDENDUM_FILE_BYTES,
      allowedContentTypes: ADDENDUM_ALLOWED_CONTENT_TYPES,
    });

    if (declaredContentType !== DOCX_CONTENT_TYPE) {
      return {
        storageKey,
        originalName,
        contentType: declaredContentType,
        sizeBytes,
      };
    }

    const docxBuffer = await this.storage.getObjectBuffer(storageKey);
    const pdfBuffer = await this.docxToPdf.convert(docxBuffer);
    if (pdfBuffer.length > MAX_ADDENDUM_FILE_BYTES) {
      throw new BadRequestException(
        'Converted PDF exceeds the 25 MB upload limit',
      );
    }
    const pdfName = sanitizeFileName(
      originalName.replace(/\.docx$/i, '.pdf') || 'addendum.pdf',
    );
    const pdfKey = buildAddendumStorageKey(
      params.projectId,
      params.addendumId,
      randomUUID(),
      pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`,
    );
    await this.storage.putObject({
      storageKey: pdfKey,
      body: pdfBuffer,
      contentType: PDF_CONTENT_TYPE,
    });
    await this.storage.deleteObject(storageKey).catch(() => undefined);
    return {
      storageKey: pdfKey,
      originalName: pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`,
      contentType: PDF_CONTENT_TYPE,
      sizeBytes: pdfBuffer.length,
    };
  }

  private async notifyCreated(
    participant: Participant,
    createdByUserId: string,
    addendumId: string,
    title: string,
  ) {
    const recipientUserId =
      createdByUserId === participant.clientUserId
        ? participant.contractorUserId
        : participant.clientUserId;
    this.notifications.dispatch(
      this.notifications.notifyContractAddendumCreated({
        recipientUserId,
        projectId: participant.projectId,
        projectTitle: participant.projectTitle,
        addendumTitle: title,
        addendumId,
        createdByIsClient: createdByUserId === participant.clientUserId,
      }),
    );
  }
}
