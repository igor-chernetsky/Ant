import { fetchWithAuth } from './auth-client';
import type { Project } from './projects';

export type AmendmentChangeType =
  | 'clarification'
  | 'scope_change'
  | 'budget_change'
  | 'timeline_change'
  | 'other';

export interface ProjectAmendment {
  id: string;
  projectId: string;
  body: string;
  changeType: AmendmentChangeType | null;
  createdAt: string;
  processedAt: string | null;
  aiResult: {
    updatedDescription: string;
    updatedSummary: string;
    tagSlugs: string[];
    confidence: number;
    provider: 'openai' | 'fallback';
  } | null;
}

export const AMENDABLE_STATUSES = new Set([
  'draft',
  'intake',
  'ready_for_estimate',
  'estimated',
  'tender_ready',
]);

export const AMENDMENT_CHANGE_TYPE_OPTIONS: Array<{
  value: AmendmentChangeType | '';
  label: string;
}> = [
  { value: '', label: 'Not specified' },
  { value: 'clarification', label: 'Clarification' },
  { value: 'scope_change', label: 'Scope change' },
  { value: 'budget_change', label: 'Budget change' },
  { value: 'timeline_change', label: 'Timeline change' },
  { value: 'other', label: 'Other' },
];

export function isAmendableProjectStatus(status: string): boolean {
  return AMENDABLE_STATUSES.has(status);
}

export async function fetchProjectAmendments(
  projectId: string,
): Promise<ProjectAmendment[]> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/amendments`,
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load amendments');
  }
  return response.json() as Promise<ProjectAmendment[]>;
}

export async function createProjectAmendment(
  projectId: string,
  input: { body: string; changeType?: AmendmentChangeType },
): Promise<ProjectAmendment> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/amendments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to save amendment');
  }
  return response.json() as Promise<ProjectAmendment>;
}

export async function processPendingAmendments(projectId: string): Promise<{
  project: Project;
  processedCount: number;
  amendments: ProjectAmendment[];
}> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/amendments/process`,
    { method: 'POST' },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to process amendments');
  }
  return response.json() as Promise<{
    project: Project;
    processedCount: number;
    amendments: ProjectAmendment[];
  }>;
}

export function formatChangeType(type: AmendmentChangeType | null): string {
  if (!type) return 'Update';
  return (
    AMENDMENT_CHANGE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
  );
}
