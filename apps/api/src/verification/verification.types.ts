import { ContractorVerificationDocCategory } from '@prisma/client';

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
  regionCode: string;
  verificationStatus: string;
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  verificationComment: string | null;
  documentCount: number;
  createdAt: string;
}

export interface AdminContractorDetail extends AdminContractorListItem {
  projectTypes: string[];
  tagSlugs: string[];
  documents: ContractorVerificationDocumentResponse[];
}

export const CONTRACTOR_VERIFICATION_DOC_CATEGORIES: Array<{
  value: ContractorVerificationDocCategory;
  label: string;
}> = [
  { value: 'business_license', label: 'Business license' },
  { value: 'registration', label: 'Company registration' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'portfolio', label: 'Portfolio / references' },
  { value: 'other', label: 'Other' },
];

export function buildContractorDocStorageKey(
  contractorId: string,
  documentId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[/\\]/g, '_').trim().slice(0, 200) || 'file';
  return `contractors/${contractorId}/verification/${documentId}/${safe}`;
}
