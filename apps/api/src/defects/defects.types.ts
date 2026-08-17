import type { DefectEventKind, DefectStatus } from '@prisma/client';
import type { DocumentResponse } from '../documents/documents.types';

export interface DefectEventDto {
  id: string;
  kind: DefectEventKind;
  comment: string | null;
  actorUserId: string;
  actorDisplayName: string | null;
  createdAt: string;
  attachments: DocumentResponse[];
}

export interface DefectDto {
  id: string;
  projectId: string;
  sequenceNumber: number;
  description: string;
  status: DefectStatus;
  createdAt: string;
  updatedAt: string;
  events: DefectEventDto[];
}

export interface DefectsOverviewDto {
  projectId: string;
  role: 'client' | 'contractor' | null;
  isDesignProject: boolean;
  defects: DefectDto[];
}

export interface CreateDefectDto {
  description: string;
}

export interface DefectCommentDto {
  comment?: string | null;
  reason?: string | null;
}
