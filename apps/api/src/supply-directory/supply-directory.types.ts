import { SupplyDirectoryKind } from '@prisma/client';
import type { ServiceLocation } from '../locations/locations.catalog';

export type DirectoryKind = SupplyDirectoryKind;

export interface SupplyDirectoryEntryDto {
  id: string;
  kind: DirectoryKind;
  companyName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  serviceLocations: ServiceLocation[];
  tagSlugs: string[];
  notes: string | null;
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
  /** Empty / omitted = matches any project location. */
  serviceLocations?: ServiceLocation[] | null;
  /** Empty / omitted = matches any project trades. */
  tagSlugs?: string[] | null;
  notes?: string | null;
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

export interface DirectoryListFilter {
  kind?: SupplyDirectoryKind;
  excludeRegistered?: boolean;
  locationRegionSlug?: string;
  locationAreaSlug?: string | null;
  /** Project trade tag slugs used for matching. */
  tagSlugs?: string[];
}
