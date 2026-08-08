import {
  CUSTOM_CONTRACT_ALLOWED_CONTENT_TYPES,
  MAX_CUSTOM_CONTRACT_BYTES,
  normalizeOptionalSignatureDataUrl,
} from './contracts.types';
import {
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  sanitizeFileName,
} from '../documents/documents.types';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from '../users/locale.types';

export type ContractAddendumStatus = 'pending_signatures' | 'fully_signed';

export interface ContractAddendumCustomFileMeta {
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  uploadedAt: string;
  hasPdf: boolean;
  hasDocx: boolean;
  pdfOriginalName: string | null;
  docxOriginalName: string | null;
}

export interface ContractAddendumAttachmentResponse {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  uploadedAt: string | null;
}

export interface ContractAddendumResponse {
  id: string;
  contractId: string;
  projectId: string;
  title: string;
  sourceDescription: string | null;
  englishBodyHtml: string | null;
  bodyLocale: SupportedLocale;
  status: ContractAddendumStatus;
  contractorSignedAt: string | null;
  clientSignedAt: string | null;
  hasContractorSignature: boolean;
  hasClientSignature: boolean;
  contractorSignatureDataUrl: string | null;
  clientSignatureDataUrl: string | null;
  hasCustomFile: boolean;
  customFile: ContractAddendumCustomFileMeta | null;
  attachments: ContractAddendumAttachmentResponse[];
  canEditDocument: boolean;
  /** Replace with PDF/DOCX (clears signatures). */
  canReplaceFile: boolean;
  /** Add/remove annex files while unsigned. */
  canManageAttachments: boolean;
  /** Delete the addendum while not fully signed. */
  canDelete: boolean;
  /** Contractor must sign before client. */
  canSign: boolean;
  fullySigned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddendumFromTextDto {
  description: string;
  title?: string;
  /** Document language for AI draft: en | ru | th */
  locale?: string;
}

export interface CreateAddendumFromFileDto {
  /** Required when creating via from-file/complete (from presign). */
  addendumId?: string;
  storageKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  title?: string;
}

export interface PresignAddendumFileDto {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignAddendumAttachmentDto {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface UpdateAddendumDocumentDto {
  englishBodyHtml: string;
}

export interface RegenerateAddendumDto {
  locale?: string;
}

export interface SignAddendumDto {
  signatureDataUrl?: string | null;
}

export {
  CUSTOM_CONTRACT_ALLOWED_CONTENT_TYPES as ADDENDUM_ALLOWED_CONTENT_TYPES,
  MAX_CUSTOM_CONTRACT_BYTES as MAX_ADDENDUM_FILE_BYTES,
  ALLOWED_CONTENT_TYPES as ADDENDUM_ATTACHMENT_CONTENT_TYPES,
  MAX_UPLOAD_BYTES as MAX_ADDENDUM_ATTACHMENT_BYTES,
  normalizeOptionalSignatureDataUrl,
};

export const MAX_ADDENDUM_ATTACHMENTS = 20;

export function parseAddendumLocale(value?: string | null): SupportedLocale {
  const trimmed = value?.trim().toLowerCase() ?? '';
  return isSupportedLocale(trimmed) ? trimmed : DEFAULT_LOCALE;
}

export function buildAddendumStorageKey(
  projectId: string,
  addendumId: string,
  uploadId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[/\\]/g, '_').trim().slice(0, 200) || 'file';
  return `projects/${projectId}/addenda/${addendumId}/custom/${uploadId}/${safe}`;
}

export function isAddendumStorageKey(
  storageKey: string,
  projectId: string,
  addendumId: string,
): boolean {
  const prefix = `projects/${projectId}/addenda/${addendumId}/custom/`;
  return storageKey.startsWith(prefix) && !storageKey.includes('..');
}

export function buildAddendumAttachmentStorageKey(
  projectId: string,
  addendumId: string,
  attachmentId: string,
  fileName: string,
): string {
  return `projects/${projectId}/addenda/${addendumId}/attachments/${attachmentId}/${sanitizeFileName(fileName)}`;
}

export function fallbackAddendumHtml(
  description: string,
  title: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const escaped = description
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const paragraphs = escaped
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join('\n');
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const copy =
    locale === 'ru'
      ? {
          intro:
            'Настоящее дополнительное соглашение дополняет основной договор между сторонами.',
          closing:
            'Во всём остальном, что не изменено настоящим соглашением, основной договор сохраняет силу.',
        }
      : locale === 'th'
        ? {
            intro:
              'ข้อตกลงเพิ่มเติมนี้เป็นส่วนเสริมของสัญญาหลักระหว่างคู่สัญญา',
            closing:
              'ยกเว้นส่วนที่แก้ไขในข้อตกลงนี้ สัญญาหลักยังคงมีผลบังคับใช้ครบถ้วน',
          }
        : {
            intro:
              'This Additional Agreement supplements the main contract between the parties.',
            closing:
              'Except as amended herein, the main contract remains in full force and effect.',
          };

  return `<h2>${safeTitle}</h2>
<p>${copy.intro}</p>
${paragraphs || '<p></p>'}
<p>${copy.closing}</p>`;
}
