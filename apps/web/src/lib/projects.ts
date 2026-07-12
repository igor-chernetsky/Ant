import { fetchWithAuth } from './auth-client';

export type ProjectType =
  | 'renovation'
  | 'new_build'
  | 'extension'
  | 'commercial_fitout'
  | 'repair'
  | 'modernization_reconstruction'
  | 'design'
  | 'other';

export type PropertyType =
  | 'apartment'
  | 'house'
  | 'commercial'
  | 'land'
  | 'other';

export type TagSource = 'client' | 'ai';

export type IntakeQuestionType = 'single' | 'multi' | 'text' | 'info';

export type IntakeStatus =
  | 'awaiting_answers'
  | 'ready_to_submit'
  | 'processing'
  | 'completed';

export interface IntakeQuestion {
  id: string;
  type: IntakeQuestionType;
  prompt: string;
  options?: Array<{ id: string; label: string }>;
  required: boolean;
  allowSkip?: boolean;
  allowCustom?: boolean;
  placeholder?: string;
}

export interface ProjectTag {
  slug: string;
  label: string;
  source: TagSource;
  groupSlug: string | null;
}

export interface ProjectBriefV1 {
  schemaVersion: 1;
  summary?: string;
  packages?: Array<{
    trade: string;
    description: string;
    quantity?: number;
    unit?: string;
    areaSqm?: number;
    sourceDocumentId?: string;
  }>;
  property?: {
    type?: PropertyType;
    areaSqm?: number;
    floors?: number;
    rooms?: number;
  };
  materials?: Record<string, unknown>;
  timeline?: Record<string, unknown>;
  design?: {
    hasPlans?: boolean;
    needsDesignTender?: boolean;
  };
  constraints?: string;
  ai?: {
    missingFields?: string[];
    confidence?: number;
    originalNarrative?: string;
    improvedDescription?: string;
    documentInsights?: Array<{
      documentId: string;
      fileName: string;
      analyzedAt: string;
      summary: string;
      confidence: number;
      provider: 'openai' | 'fallback';
      omittedNote?: string;
      keyFacts?: string[];
    }>;
    intake?: {
      status: IntakeStatus;
      improvedDescription?: string;
      answers: Array<{
        questionId: string;
        value: string | string[];
        skipped?: boolean;
        customText?: string;
        answeredAt: string;
      }>;
      currentQuestion: IntakeQuestion | null;
      askedQuestionIds: string[];
      provider: 'openai' | 'fallback';
    };
  };
}

import type { BallparkEstimate } from '@/lib/estimate';

export type ClarificationMode = 'open_chat' | 'structured_qa';

export interface Project {
  id: string;
  title: string;
  description: string | null;
  projectType: ProjectType;
  propertyType: PropertyType | null;
  district: string | null;
  locationRegionSlug: string;
  locationAreaSlug: string | null;
  locationNote: string | null;
  regionCode: string;
  status: string;
  isHidden: boolean;
  readinessScore: number;
  brief: ProjectBriefV1 | null;
  clarificationMode: ClarificationMode;
  clarificationSummary: string | null;
  scopeSummary: string | null;
  tags: ProjectTag[];
  estimate: BallparkEstimate | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  title: string;
  description?: string;
  regionCode?: string;
  projectType?: ProjectType;
  propertyType?: PropertyType;
  district?: string;
  locationRegionSlug?: string;
  locationAreaSlug?: string;
  locationNote?: string;
  clarificationMode?: ClarificationMode;
}

export const CLARIFICATION_MODE_OPTIONS: Array<{
  value: ClarificationMode;
  label: string;
  description: string;
}> = [
  {
    value: 'open_chat',
    label: 'Open chat',
    description:
      'Contractors ask questions in a live chat thread (default).',
  },
  {
    value: 'structured_qa',
    label: 'Structured questions',
    description:
      'Contractors submit a question list once; you answer a merged checklist.',
  },
];

export const PROJECT_TYPE_OPTIONS: Array<{ value: ProjectType; label: string }> =
  [
    { value: 'renovation', label: 'Renovation' },
    { value: 'modernization_reconstruction', label: 'Modernization & reconstruction' },
    { value: 'new_build', label: 'New build' },
    { value: 'extension', label: 'Extension' },
    { value: 'commercial_fitout', label: 'Commercial fit-out' },
    { value: 'design', label: 'Design' },
    { value: 'repair', label: 'Repair' },
    { value: 'other', label: 'Other' },
  ];

export const PROPERTY_TYPE_OPTIONS: Array<{
  value: PropertyType;
  label: string;
}> = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'land', label: 'Land' },
  { value: 'other', label: 'Other' },
];

export async function fetchProjects(): Promise<Project[]> {
  const response = await fetchWithAuth('/api/projects');
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load projects');
  }
  return response.json() as Promise<Project[]>;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const response = await fetchWithAuth('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to create project');
  }
  return response.json() as Promise<Project>;
}

export async function fetchProject(id: string): Promise<Project> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(id)}`,
  );

  if (response.status === 403) {
    throw new Error('FORBIDDEN');
  }
  if (response.status === 404) {
    throw new Error('NOT_FOUND');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load project');
  }
  return response.json() as Promise<Project>;
}

const DELETABLE_STATUSES = new Set([
  'draft',
  'intake',
  'ready_for_estimate',
]);

const DELETABLE_DOCUMENT_STATUSES = new Set([
  'draft',
  'intake',
  'ready_for_estimate',
  'estimated',
]);

export function canDeleteProject(project: Pick<Project, 'status'>): boolean {
  return DELETABLE_STATUSES.has(project.status);
}

export function canManageProjectLifecycle(
  project: Pick<Project, 'status'>,
): boolean {
  return !DELETABLE_STATUSES.has(project.status);
}

export async function hideProject(id: string): Promise<Project> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(id)}/hide`,
    { method: 'POST' },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to hide project');
  }
  return response.json() as Promise<Project>;
}

export async function unhideProject(id: string): Promise<Project> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(id)}/unhide`,
    { method: 'POST' },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to unhide project');
  }
  return response.json() as Promise<Project>;
}

export async function closeProject(
  id: string,
  input: import('@/lib/project-reviews').CompleteProjectInput,
): Promise<Project> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(id)}/close`,
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
    throw new Error(body?.message ?? 'Failed to complete project');
  }
  return response.json() as Promise<Project>;
}

export function canDeleteDocument(project: Pick<Project, 'status'>): boolean {
  return DELETABLE_DOCUMENT_STATUSES.has(project.status);
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to delete project');
  }
}

export function formatProjectStatus(status: string): string {
  if (status === 'hidden') {
    return 'Hidden projects';
  }
  const labels: Record<string, string> = {
    awarded: 'Winner selected',
    ready_for_estimate: 'Ready for estimate',
    in_tender: 'In tender',
  };
  return labels[status] ?? status.replaceAll('_', ' ');
}

export function formatProjectType(type: ProjectType): string {
  return PROJECT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function formatPropertyType(type: PropertyType | null): string {
  if (!type) return '—';
  return PROPERTY_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
