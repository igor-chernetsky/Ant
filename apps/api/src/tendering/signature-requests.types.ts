export type SignatureRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ContractSignatureAuthDto {
  platformFeePaid: boolean;
  hasBankDetails: boolean;
  latestRequest: {
    id: string;
    status: SignatureRequestStatus;
    rejectionReason: string | null;
    createdAt: string;
    reviewedAt: string | null;
  } | null;
}

export interface SignatureRequestListItemDto {
  id: string;
  status: SignatureRequestStatus;
  projectId: string;
  projectTitle: string;
  contractId: string;
  contractorId: string;
  companyName: string | null;
  contractorEmail: string | null;
  bankName: string | null;
  bankAccount: string | null;
  currency: string;
  contractAmount: number | null;
  accessFeeUsd: number;
  dueNowListed: number | null;
  dueNowPayable: number;
  successFeeGross: number | null;
  trialActive: boolean;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface RejectSignatureRequestDto {
  reason: string;
}
