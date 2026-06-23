import {
  ProjectType,
  PropertyType,
  TagSource,
  ClarificationMode,
} from '@prisma/client';
import { ProjectBriefV1 } from './project-brief';
import { EstimateResponse } from '../estimation/estimates.types';

export interface ProjectTagResponse {
  slug: string;
  label: string;
  source: TagSource;
  groupSlug: string | null;
}

export interface CreateProjectDto {
  title: string;
  description?: string;
  regionCode?: string;
  projectType?: ProjectType;
  propertyType?: PropertyType;
  district?: string;
  clarificationMode?: ClarificationMode;
}

export interface ProjectResponse {
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
  clarificationMode: ClarificationMode;
  clarificationSummary: string | null;
  tags: ProjectTagResponse[];
  estimate: EstimateResponse | null;
  createdAt: string;
  updatedAt: string;
}

export interface TagCatalogItem {
  slug: string;
  label: string;
  groupSlug: string | null;
  groupLabel: string | null;
  isSystem: boolean;
}

export interface CreateTagDto {
  label: string;
  groupSlug?: string;
}

export interface PublicProjectTag {
  slug: string;
  label: string;
}

export interface PublicProjectCard {
  id: string;
  title: string;
  description: string | null;
  projectType: ProjectType;
  district: string | null;
  regionCode: string;
  status: string;
  readinessScore: number;
  tags: PublicProjectTag[];
  coverImageUrl: string | null;
  updatedAt: string;
}
