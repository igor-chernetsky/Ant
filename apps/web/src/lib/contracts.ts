import { fetchWithAuth } from './auth-client';

export type ContractStatus = 'pending_signatures' | 'fully_signed';

export type SignatureRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ContractSignatureAuth {
  platformFeePaid: boolean;
  hasBankDetails: boolean;
  latestRequest: {
    id: string;
    status: SignatureRequestStatus;
    rejectionReason: string | null;
    createdAt: string;
    reviewedAt: string | null;
  } | null;
}

export interface ContractCustomFile {
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  uploadedAt: string;
  hasPdf?: boolean;
  hasDocx?: boolean;
  pdfOriginalName?: string | null;
  docxOriginalName?: string | null;
}

export type CustomFileDownloadFormat = 'pdf' | 'docx';

export function customFileHasBothFormats(
  file: Pick<ContractCustomFile, 'hasPdf' | 'hasDocx'> | null | undefined,
): boolean {
  return Boolean(file?.hasPdf && file?.hasDocx);
}

export function customFileCanPreviewPdf(
  file: Pick<ContractCustomFile, 'hasPdf' | 'contentType' | 'originalName'> | null | undefined,
): boolean {
  if (!file) return false;
  if (typeof file.hasPdf === 'boolean') return file.hasPdf;
  const contentType = (file.contentType ?? '').toLowerCase();
  const name = (file.originalName ?? '').toLowerCase();
  return contentType.includes('pdf') || name.endsWith('.pdf');
}

export interface ProjectContract {
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
  customFile: ContractCustomFile | null;
  canSign: boolean;
  canEditDocument: boolean;
  fullySigned: boolean;
  signatureAuth: ContractSignatureAuth | null;
}

export const MAX_CUSTOM_CONTRACT_BYTES = 25 * 1024 * 1024;

const CUSTOM_CONTRACT_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function contractPath(projectId: string, asContractor: boolean): string {
  return asContractor
    ? `/api/contractor/projects/${encodeURIComponent(projectId)}/contract`
    : `/api/projects/${encodeURIComponent(projectId)}/contract`;
}

async function parseError(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  throw new Error(body?.message ?? fallback);
}

export async function fetchProjectContract(
  projectId: string,
  options?: { asContractor?: boolean },
): Promise<ProjectContract | null> {
  const response = await fetchWithAuth(contractPath(projectId, Boolean(options?.asContractor)));
  if (!response.ok) {
    await parseError(response, 'Failed to load contract');
  }
  const data = (await response.json()) as ProjectContract | { contract: null };
  if ('contract' in data && data.contract === null) {
    return null;
  }
  return data as ProjectContract;
}

export async function signProjectContract(
  projectId: string,
  options?: {
    asContractor?: boolean;
    signatureDataUrl?: string | null;
  },
): Promise<ProjectContract> {
  const response = await fetchWithAuth(
    contractPath(projectId, Boolean(options?.asContractor)),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signatureDataUrl: options?.signatureDataUrl ?? null,
      }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to sign contract');
  }
  return response.json() as Promise<ProjectContract>;
}

export async function updateProjectContractDocument(
  projectId: string,
  englishBodyHtml: string,
  options?: { asContractor?: boolean },
): Promise<ProjectContract> {
  const asContractor = Boolean(options?.asContractor);
  const path = asContractor
    ? `/api/contractor/projects/${encodeURIComponent(projectId)}/contract/document`
    : `/api/projects/${encodeURIComponent(projectId)}/contract/document`;
  const response = await fetchWithAuth(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ englishBodyHtml }),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to save contract document');
  }
  return response.json() as Promise<ProjectContract>;
}

export async function regenerateProjectContractDocument(
  projectId: string,
  options?: { asContractor?: boolean },
): Promise<ProjectContract> {
  const asContractor = Boolean(options?.asContractor);
  const path = asContractor
    ? `/api/contractor/projects/${encodeURIComponent(projectId)}/contract/document/regenerate`
    : `/api/projects/${encodeURIComponent(projectId)}/contract/document/regenerate`;
  const response = await fetchWithAuth(path, { method: 'POST' });
  if (!response.ok) {
    await parseError(response, 'Failed to regenerate contract document');
  }
  return response.json() as Promise<ProjectContract>;
}

export function resolveCustomContractContentType(file: File): string {
  const typed = file.type?.trim().toLowerCase();
  if (typed && typed !== 'application/octet-stream') {
    return typed;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return typed || 'application/octet-stream';
}

export function assertCustomContractFile(file: File): string {
  if (file.size < 1 || file.size > MAX_CUSTOM_CONTRACT_BYTES) {
    throw new Error('File exceeds 25 MB limit');
  }
  const contentType = resolveCustomContractContentType(file);
  if (!CUSTOM_CONTRACT_CONTENT_TYPES.has(contentType)) {
    throw new Error('Only PDF and DOCX files are supported');
  }
  return contentType;
}

export async function uploadCustomContractFile(
  projectId: string,
  file: File,
  options?: { asContractor?: boolean },
): Promise<ProjectContract> {
  const asContractor = Boolean(options?.asContractor);
  const contentType = assertCustomContractFile(file);
  const base = contractPath(projectId, asContractor);

  const presignResponse = await fetchWithAuth(`${base}/custom-file/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    }),
  });
  if (!presignResponse.ok) {
    await parseError(presignResponse, 'Failed to prepare contract upload');
  }
  const presigned = (await presignResponse.json()) as {
    uploadUrl: string;
    storageKey: string;
  };

  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error('Upload to storage failed');
  }

  const completeResponse = await fetchWithAuth(`${base}/custom-file/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storageKey: presigned.storageKey,
      originalName: file.name,
      contentType,
      sizeBytes: file.size,
    }),
  });
  if (!completeResponse.ok) {
    await parseError(completeResponse, 'Failed to confirm contract upload');
  }
  return completeResponse.json() as Promise<ProjectContract>;
}

export async function downloadCustomContractFile(
  projectId: string,
  options?: {
    asContractor?: boolean;
    formats?: CustomFileDownloadFormat[];
  },
): Promise<void> {
  const asContractor = Boolean(options?.asContractor);
  const formats = options?.formats?.filter(
    (item): item is CustomFileDownloadFormat =>
      item === 'pdf' || item === 'docx',
  );
  const needsFormatDownload =
    Boolean(formats?.includes('docx')) || (formats?.length ?? 0) > 1;

  // PDF-only stays on the legacy presigned GET path.
  if (!needsFormatDownload) {
    const response = await fetchWithAuth(
      `${contractPath(projectId, asContractor)}/custom-file`,
    );
    if (!response.ok) {
      await parseError(response, 'Failed to get contract download link');
    }
    const data = (await response.json()) as {
      downloadUrl: string;
      originalName: string;
    };
    const anchor = document.createElement('a');
    anchor.href = data.downloadUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }

  const response = await fetchWithAuth(
    `${contractPath(projectId, asContractor)}/custom-file/download`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formats }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to download custom contract');
  }

  const blob = await response.blob();
  const fileName =
    parseContentDispositionFilename(
      response.headers.get('content-disposition'),
    ) ??
    (formats && formats.length > 1
      ? 'contract-files.zip'
      : formats?.[0] === 'docx'
        ? 'contract.docx'
        : 'contract.pdf');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseContentDispositionFilename(
  header: string | null,
): string | null {
  if (!header) return null;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      return utfMatch[1].trim();
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  return plainMatch?.[1]?.trim() ?? null;
}
