import { fetchWithAuth } from './auth-client';

export type ContractStatus = 'pending_signatures' | 'fully_signed';

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
  englishBodyHtml: string | null;
  canSign: boolean;
  canEditDocument: boolean;
  fullySigned: boolean;
}

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
