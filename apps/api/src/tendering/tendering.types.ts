import { BidStatus, ProjectType, TenderInvitationStatus, TenderStatus } from '@prisma/client';

export interface BidLineItem {
  trade: string;
  description: string;
  amount: number;
}

/** Stored in Bid.termsJson — versioned payload for contractor proposals */
export interface BidTermsV1 {
  /** Short comment visible to the client (conditions, assumptions) */
  notes?: string;
  /** How the contractor plans to execute the work */
  approach?: string;
  /** Optional high-level scope summary */
  scopeSummary?: string;
  lineItems?: BidLineItem[];
}

export const MAX_BID_NOTES_LENGTH = 2000;
export const MAX_BID_APPROACH_LENGTH = 8000;
export const MAX_BID_SCOPE_LENGTH = 2000;
export const MAX_BID_LINE_ITEMS = 20;

export interface ContractorProfileResponse {
  id: string;
  userId: string;
  companyName: string | null;
  regionCode: string;
  projectTypes: ProjectType[];
  verificationStatus: string;
  verificationComment: string | null;
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  createdAt: string;
}

export interface UpsertContractorProfileDto {
  companyName?: string;
  regionCode?: string;
  projectTypes?: ProjectType[];
}

export interface TenderInvitationResponse {
  id: string;
  contractorId: string;
  companyName: string | null;
  status: TenderInvitationStatus;
  invitedAt: string;
  respondedAt: string | null;
}

export interface BidResponse {
  id: string;
  tenderId: string;
  contractorId: string;
  companyName: string | null;
  status: BidStatus;
  amount: string;
  durationDays: number | null;
  terms: BidTermsV1 | null;
  submittedAt: string;
}

export interface TenderResponse {
  id: string;
  projectId: string;
  status: TenderStatus;
  currency: string;
  minBids: number;
  opensAt: string | null;
  closesAt: string | null;
  awardedBidId: string | null;
  invitations: TenderInvitationResponse[];
  bids: BidResponse[];
  acceptedInvitationCount: number;
  submittedBidCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContractorInvitationItem {
  invitationId: string;
  tenderId: string;
  projectId: string;
  projectTitle: string;
  projectDistrict: string | null;
  tenderStatus: TenderStatus;
  invitationStatus: TenderInvitationStatus;
  closesAt: string | null;
  invitedAt: string;
}

export interface SubmitBidDto {
  amount: number;
  durationDays?: number;
  notes?: string;
  approach?: string;
  scopeSummary?: string;
  lineItems?: BidLineItem[];
}

export interface RespondInvitationDto {
  accept: boolean;
}

export const DEFAULT_TENDER_DURATION_DAYS = 7;
export const MAX_TENDER_INVITATIONS = 8;
