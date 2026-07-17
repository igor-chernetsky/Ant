export type ContractStatus = 'pending_signatures' | 'fully_signed';

export interface SignContractDto {
  /** Optional PNG/JPEG data URL from a drawn signature pad. */
  signatureDataUrl?: string | null;
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
  canSign: boolean;
  fullySigned: boolean;
}

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
