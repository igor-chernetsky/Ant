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
  /** @deprecated use locationRegionSlug / locationAreaSlug / locationNote */
  district?: string;
  locationRegionSlug?: string;
  locationAreaSlug?: string;
  locationNote?: string;
  clarificationMode?: ClarificationMode;
}

export interface ProjectResponse {
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
  locationRegionSlug: string;
  locationAreaSlug: string | null;
  locationNote: string | null;
  regionCode: string;
  status: string;
  isHidden: boolean;
  readinessScore: number;
  tags: PublicProjectTag[];
  coverImageUrl: string | null;
  updatedAt: string;
  applicationsDeadlinePassed: boolean;
}

export interface ProjectCompletionContext {
  canComplete: boolean;
  contractorName: string | null;
  reason: string | null;
}

export interface CompleteProjectDto {
  comment?: string;
  ratings: Record<string, number>;
  attachmentIds?: string[];
}

export interface PresignProjectReviewAttachmentDto {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface ContractorReviewItem {
  id: string;
  projectId: string;
  projectTitle: string;
  comment: string | null;
  ratings: Record<string, number>;
  averageRating: number;
  createdAt: string;
  clientName: string | null;
}

export interface ProjectReviewAttachmentResponse {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  uploadedAt: string | null;
}

export interface PresignProjectReviewAttachmentResponse {
  attachmentId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}
