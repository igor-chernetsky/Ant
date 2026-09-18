import {
  ContractorVerificationDocCategory,
  SupplyProfileKind,
} from '@prisma/client';

export interface ContractorVerificationDocumentResponse {
  id: string;
  contractorId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  category: ContractorVerificationDocCategory;
  status: string;
  createdAt: string;
  uploadedAt: string | null;
}

export interface PresignContractorDocDto {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  category?: ContractorVerificationDocCategory;
}

export interface RejectContractorDto {
  comment: string;
}

export interface AdminContractorListItem {
  id: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  companyName: string | null;
  phone: string | null;
  taxId: string | null;
  preferredContactMethods: Array<'phone' | 'line' | 'whatsapp' | 'email'>;
  bankName: string | null;
  bankAccount: string | null;
  regionCode: string | null;
  kind: SupplyProfileKind;
  verificationStatus: string;
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  verificationComment: string | null;
  documentCount: number;
  createdAt: string;
  hasProfile: boolean;
}

/** A trade the company asked to be listed for, resolved to a readable label. */
export interface AdminContractorTrade {
  slug: string;
  label: string;
  groupLabel: string | null;
}

/** A service area the company covers, resolved to a readable label. */
export interface AdminContractorLocation {
  regionSlug: string;
  areaSlug: string | null;
  /** `"Area, Region"`, or just the region when the whole region is covered. */
  label: string;
}

export interface AdminContractorDetail extends AdminContractorListItem {
  projectTypes: string[];
  tagSlugs: string[];
  /** Trades requested by the company, in the order they selected them. */
  trades: AdminContractorTrade[];
  /** Regions/areas the company covers, in the order they selected them. */
  serviceLocations: AdminContractorLocation[];
  documents: ContractorVerificationDocumentResponse[];
}

/** Supply profile whose owner is missing the matching Keycloak realm role. */
export interface AdminSupplyRoleGap {
  userId: string;
  kind: SupplyProfileKind;
  companyName: string | null;
  email: string | null;
  displayName: string | null;
  keycloakSub: string;
  verificationStatus: string;
}

export const CONTRACTOR_VERIFICATION_DOC_CATEGORIES: Array<{
  value: ContractorVerificationDocCategory;
  label: string;
}> = [
  { value: 'business_license', label: 'Business license' },
  { value: 'registration', label: 'Company registration' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'owners_id', label: "Owner's ID" },
  { value: 'portfolio', label: 'Portfolio / references' },
  { value: 'other', label: 'Other' },
];

/** Categories attached to every awarded contract draft (ZIP + annex links). */
export const CONTRACT_ATTACHMENT_VERIFICATION_CATEGORIES: ContractorVerificationDocCategory[] =
  ['business_license', 'registration', 'insurance', 'owners_id'];

export function buildContractorDocStorageKey(
  contractorId: string,
  documentId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[/\\]/g, '_').trim().slice(0, 200) || 'file';
  return `contractors/${contractorId}/verification/${documentId}/${safe}`;
}
