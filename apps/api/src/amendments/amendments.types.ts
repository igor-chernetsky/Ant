import { AmendmentChangeType } from '@prisma/client';
import { AmendmentAiResult } from '../ai/amendment.types';
import { ProjectResponse } from '../projects/projects.types';

export interface CreateAmendmentDto {
  body: string;
  changeType?: AmendmentChangeType;
}

export interface AmendmentResponse {
  id: string;
  projectId: string;
  body: string;
  changeType: AmendmentChangeType | null;
  createdAt: string;
  processedAt: string | null;
  aiResult: AmendmentAiResult | null;
}

export interface ProcessAmendmentsResult {
  project: ProjectResponse;
  processedCount: number;
  amendments: AmendmentResponse[];
}
