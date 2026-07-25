import { SupplyDirectoryKind } from '@prisma/client';

export type DirectoryKind = SupplyDirectoryKind;

export interface SupplyDirectoryEntryDto {
  id: string;
  kind: DirectoryKind;
  companyName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  regionSlug: string | null;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertDirectoryEntryDto {
  kind: DirectoryKind;
  companyName: string;
  contactName?: string | null;
  email: string;
  phone?: string | null;
  website?: string | null;
  regionSlug?: string | null;
  notes?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface InviteDirectoryRecipientsDto {
  entryIds: string[];
}

export interface InviteManualRecipientDto {
  email: string;
  name?: string;
  kind: DirectoryKind;
}

export interface TenderInviteResultDto {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  kind: DirectoryKind;
  emailSent: boolean;
  inviteUrl: string;
}
