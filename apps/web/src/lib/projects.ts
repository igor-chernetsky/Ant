export type ProjectType =
  | 'renovation'
  | 'new_build'
  | 'extension'
  | 'commercial_fitout'
  | 'repair'
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

export interface Project {
  id: string;
  title: string;
  description: string | null;
  projectType: ProjectType;
  propertyType: PropertyType | null;
  district: string | null;
  regionCode: string;
  status: string;
  readinessScore: number;
  brief: ProjectBriefV1 | null;
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
}

export const PROJECT_TYPE_OPTIONS: Array<{ value: ProjectType; label: string }> =
  [
    { value: 'renovation', label: 'Renovation' },
    { value: 'new_build', label: 'New build' },
    { value: 'extension', label: 'Extension' },
    { value: 'commercial_fitout', label: 'Commercial fit-out' },
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
  const response = await fetch('/api/projects', { credentials: 'include' });
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
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
  const response = await fetch('/api/projects', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to create project');
  }
  return response.json() as Promise<Project>;
}

export async function fetchProject(id: string): Promise<Project> {
  const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });

  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
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

export function canDeleteProject(project: Pick<Project, 'status'>): boolean {
  return DELETABLE_STATUSES.has(project.status);
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to delete project');
  }
}

export function formatProjectStatus(status: string): string {
  return status.replaceAll('_', ' ');
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
