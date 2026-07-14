import { AmendmentChangeType } from '@prisma/client';
import { ProjectBriefV1 } from '../projects/project-brief';

export interface AmendmentContext {
  title: string;
  description: string | null;
  projectType: string;
  propertyType: string | null;
  district: string | null;
  brief: ProjectBriefV1;
  amendments: Array<{
    body: string;
    changeType: AmendmentChangeType | null;
    createdAt: string;
  }>;
  availableTagSlugs: string[];
  locale?: string;
}

export interface AmendmentAiResult {
  updatedDescription: string;
  updatedSummary: string;
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
