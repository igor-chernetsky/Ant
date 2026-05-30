import {
  ProjectType,
  PropertyType,
  TagSource,
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
