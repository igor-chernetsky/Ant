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

/** Owner may update card title/description/property type at any project status. */
export interface UpdateProjectDto {
  title?: string;
  description?: string | null;
  propertyType?: PropertyType | null;
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
  linkedProjectId: string | null;
  linkKind: 'none' | 'design_active' | 'construction_pending';
  designFeePercent: number | null;
  canConvertToDesign: boolean;
  canResumeConstruction: boolean;
  brief: ProjectBriefV1 | null;
  clarificationMode: ClarificationMode;
  clarificationSummary: string | null;
  scopeSummary: string | null;
  tags: ProjectTagResponse[];
  estimate: EstimateResponse | null;
  createdAt: string;
  updatedAt: string;
  /** Present when opened via a valid tender invite token (read-only guest view). */
  guestInviteAccess?: {
    canView: true;
    canSubmitProposal: false;
  };
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

export interface PublicProjectEstimateSummary {
  minAmount: number;
  maxAmount: number;
  midAmount: number;
  currency: string;
  confidence: number;
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
  /** Whether the current viewer may open the project detail card. */
  canOpenDetail: boolean;
  /** Latest ballpark totals when an estimate exists. */
  estimate: PublicProjectEstimateSummary | null;
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
