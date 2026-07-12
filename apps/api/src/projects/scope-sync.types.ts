import { ProjectBriefV1 } from '../projects/project-brief';

export type ScopeSyncSource =
  | 'clarification_answer'
  | 'clarification_attachment'
  | 'client_chat';

export interface ScopeSyncUpdate {
  source: ScopeSyncSource;
  /** Human-readable fact block passed to the model. */
  body: string;
}

export interface ScopeSyncContext {
  title: string;
  description: string | null;
  scopeSummary: string | null;
  projectType: string;
  propertyType: string | null;
  district: string | null;
  brief: ProjectBriefV1;
  update: ScopeSyncUpdate;
  availableTagSlugs: string[];
  locale: string;
}

export interface ScopeSyncResult {
  applied: boolean;
  updatedDescription: string;
  updatedSummary: string;
  updatedScopeSummary: string;
  tagSlugs: string[];
  confidence: number;
  provider: 'openai' | 'fallback';
  briefPatches?: {
    constraints?: string;
    property?: ProjectBriefV1['property'];
    timeline?: ProjectBriefV1['timeline'];
    materials?: ProjectBriefV1['materials'];
  };
}
