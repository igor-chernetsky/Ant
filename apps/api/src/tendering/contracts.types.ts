export type ContractStatus = 'pending_signatures' | 'fully_signed';

export interface SignContractDto {
  /** Optional PNG/JPEG data URL from a drawn signature pad. */
  signatureDataUrl?: string | null;
}

export interface UpdateContractDocumentDto {
  englishBodyHtml: string;
}

export interface PresignCustomContractFileDto {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface CompleteCustomContractFileDto {
  storageKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
}

export interface ContractCustomFileMeta {
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  uploadedAt: string;
}

export interface ContractResponse {
  id: string;
  projectId: string;
  bidId: string;
  status: ContractStatus;
  projectStatus: string;
  clientSignedAt: string | null;
  contractorSignedAt: string | null;
  hasClientSignature: boolean;
  hasContractorSignature: boolean;
  clientSignatureDataUrl: string | null;
  contractorSignatureDataUrl: string | null;
  englishBodyHtml: string | null;
  hasCustomContract: boolean;
  customFile: ContractCustomFileMeta | null;
  canSign: boolean;
  canEditDocument: boolean;
  fullySigned: boolean;
}

/** PDF and DOCX only for party-uploaded contract files. */
export const CUSTOM_CONTRACT_ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const MAX_CUSTOM_CONTRACT_BYTES = 25 * 1024 * 1024;

/** Max length for a PNG/JPEG data URL (~375KB binary → ~500KB base64 text). */
export const MAX_SIGNATURE_DATA_URL_LENGTH = 700_000;

const SIGNATURE_DATA_URL_RE =
  /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$/;

export function normalizeOptionalSignatureDataUrl(
  value: unknown,
): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error('Signature must be a data URL string');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > MAX_SIGNATURE_DATA_URL_LENGTH) {
    throw new Error('Signature image is too large');
  }
  if (!SIGNATURE_DATA_URL_RE.test(trimmed)) {
    throw new Error('Signature must be a PNG or JPEG data URL');
  }
  return trimmed.replace(/\s+/g, '');
}

export function buildCustomContractStorageKey(
  projectId: string,
  contractId: string,
  uploadId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[/\\]/g, '_').trim().slice(0, 200) || 'file';
  return `projects/${projectId}/contracts/${contractId}/custom/${uploadId}/${safe}`;
}

export function isCustomContractStorageKeyForContract(
  storageKey: string,
  projectId: string,
  contractId: string,
): boolean {
  const prefix = `projects/${projectId}/contracts/${contractId}/custom/`;
  return storageKey.startsWith(prefix) && !storageKey.includes('..');
}
