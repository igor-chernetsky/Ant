import { BidStatus, ProjectType, TenderStatus } from '@prisma/client';

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
  tagSlugs: string[];
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
  tagSlugs?: string[];
}

export interface BidMessageResponse {
  id: string;
  bidId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface BidResponse {
  id: string;
  tenderId: string;
  contractorId: string;
  companyName: string | null;
  status: BidStatus;
  contenderNumber: number | null;
  enrolledAt: string | null;
  amount: string | null;
  durationDays: number | null;
  terms: BidTermsV1 | null;
  submittedAt: string | null;
}

export interface BidOfferResponse {
  id: string;
  bidId: string;
  authorRole: 'client' | 'contractor';
  authorId: string;
  amount: string;
  durationDays: number | null;
  terms: BidTermsV1 | null;
  note: string | null;
  createdAt: string;
}

export interface SubmitCounterOfferDto {
  amount: number;
  durationDays?: number;
  notes?: string;
  approach?: string;
  scopeSummary?: string;
  lineItems?: BidLineItem[];
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
  bids: BidResponse[];
  submittedBidCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContractorApplicationItem {
  bidId: string;
  tenderId: string;
  projectId: string;
  projectTitle: string;
  projectDistrict: string | null;
  tenderStatus: TenderStatus;
  bidStatus: BidStatus;
  contenderNumber: number | null;
  bidAmount: string | null;
  submittedAt: string | null;
  isActiveProject: boolean;
}

export interface ContractorProjectParticipation {
  tenderId: string | null;
  tenderStatus: TenderStatus | null;
  closesAt: string | null;
  myBid: BidResponse | null;
  verificationStatus: string;
  canStartClarification: boolean;
  canEnroll: boolean;
  canSubmitProposal: boolean;
  canWithdraw: boolean;
  accessDenied: boolean;
  projectStatus: string;
}

export interface ContractorTenderView {
  tender: TenderResponse;
  myBid: BidResponse | null;
}

export interface SubmitBidDto {
  amount: number;
  durationDays?: number;
  notes?: string;
  approach?: string;
  scopeSummary?: string;
  lineItems?: BidLineItem[];
}

export interface SendBidMessageDto {
  body: string;
}

export const DEFAULT_TENDER_DURATION_DAYS = 7;
