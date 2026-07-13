import { BidStatus, ProjectType, TenderStatus } from '@prisma/client';
import type { ClarificationAttachmentResponse } from './clarification-attachments.types';

export type { ClarificationAttachmentResponse } from './clarification-attachments.types';

export interface BidLineItem {
  trade: string;
  description?: string;
  amount: number;
}

/** Legal fields for downloadable commercial proposal document. */
export interface BidContractTerms {
  subjectOfContract?: string;
  siteAddress?: string;
  propertyOwnership?: string;
  employerName?: string;
  employerAddress?: string;
  employerRegistrationNo?: string;
  contractorAddress?: string;
  contractorRegistrationNo?: string;
  contractorRepresentative?: string;
  advancePaymentPercent?: number;
  advancePaymentAmount?: number;
  worksStartDate?: string;
  contractPeriodMonths?: number;
  retentionPercent?: number;
  retentionLimitPercent?: number;
  retentionReleaseNotes?: string;
  defectNotificationMonths?: number;
  warrantyPeriodNotes?: string;
  delayDamagesNotes?: string;
  /** Free-text special conditions appended to the document when set. */
  specialConditions?: string;
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
  /** Commercial proposal document fields for PDF/HTML generation */
  contractTerms?: BidContractTerms;
}

export const MAX_BID_NOTES_LENGTH = 2000;
export const MAX_BID_APPROACH_LENGTH = 8000;
export const MAX_BID_SCOPE_LENGTH = 2000;
export const MAX_BID_SPECIAL_CONDITIONS_LENGTH = 4000;
export const MAX_BID_LINE_ITEMS = 20;
export const MAX_DEFAULT_COST_BREAKDOWN_ITEMS = 20;

/** Tender-wide cost breakdown template (no amounts). */
export interface DefaultCostBreakdownItem {
  trade: string;
  description?: string;
}

export interface ContractorProfileResponse {
  id: string;
  userId: string;
  companyName: string | null;
  regionCode: string;
  serviceLocations: Array<{ regionSlug: string; areaSlug?: string }>;
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
  serviceLocations?: Array<{ regionSlug: string; areaSlug?: string }>;
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
  /** When true, send the same counter-offer to all submitted bids without a client counter-offer yet. */
  applyToAllPending?: boolean;
}

export interface CounterOfferTargetsResponse {
  count: number;
  bidIds: string[];
}

export interface CreateCounterOfferResponse {
  offer: BidOfferResponse;
  sentToBidCount: number;
}

export interface TenderResponse {
  id: string;
  projectId: string;
  status: TenderStatus;
  currency: string;
  minBids: number;
  opensAt: string | null;
  closesAt: string | null;
  noApplicationsDeadline: boolean;
  applicationsDeadlinePassed: boolean;
  awardedBidId: string | null;
  bids: BidResponse[];
  /** All active applications (clarifying, enrolled, submitted, etc.) */
  applicationCount: number;
  /** Submitted commercial proposals only */
  submittedBidCount: number;
  defaultCostBreakdown: DefaultCostBreakdownItem[];
  projectContractTerms: BidContractTerms;
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
  projectStatus: string;
  projectType: string;
  description: string | null;
  coverImageUrl: string | null;
}

export interface ContractorProjectParticipation {
  tenderId: string | null;
  tenderStatus: TenderStatus | null;
  closesAt: string | null;
  myBid: BidResponse | null;
  verificationStatus: string;
  clarificationMode: 'open_chat' | 'structured_qa';
  hasSubmittedClarificationQuestions: boolean;
  clarificationProgress: {
    totalQuestions: number;
    answeredQuestions: number;
    allAnswered: boolean;
  };
  tenderCollectingClarifications: boolean;
  defaultCostBreakdown: DefaultCostBreakdownItem[];
  projectScopeSummary: string | null;
  projectContractTerms: BidContractTerms;
  canStartClarification: boolean;
  canApply: boolean;
  canEnroll: boolean;
  canSubmitProposal: boolean;
  canEditCommercialProposal: boolean;
  canWithdrawFromAward: boolean;
  contractFullySigned: boolean;
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
  contractTerms?: BidContractTerms;
}

export interface UpdateBidContractTermsDto {
  contractTerms: BidContractTerms;
}

export interface SendBidMessageDto {
  body: string;
}

export interface ClarificationQuestionResponse {
  id: string;
  questionText: string;
  sortOrder: number;
  answer: string | null;
  answeredAt: string | null;
  sourceBidIds: string[];
  askedByCount: number;
  attachments: ClarificationAttachmentResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface ClarificationQuestionsForClientResponse {
  questions: ClarificationQuestionResponse[];
  fullyAnsweredContractorCount: number;
  totalContractorCount: number;
}

export interface ContractorClarificationAttachmentQuestion {
  id: string;
  questionText: string;
  attachments: ClarificationAttachmentResponse[];
}

export interface ContractorClarificationAttachmentsResponse {
  questions: ContractorClarificationAttachmentQuestion[];
}

export interface SubmitBidClarificationQuestionsDto {
  questions: string[];
}

export interface AnswerClarificationQuestionDto {
  answer: string;
}

export interface PublishTenderDto {
  /** YYYY-MM-DD or ISO datetime; ignored when noApplicationsDeadline is true */
  applicationsCloseAt?: string;
  noApplicationsDeadline?: boolean;
  scopeSummary?: string;
  clarificationSummary?: string;
  defaultCostBreakdown?: DefaultCostBreakdownItem[];
  contractTerms?: BidContractTerms;
}

export interface TenderPublishPreview {
  scopeSummary: string;
  clarificationSummary: string | null;
  defaultCostBreakdown: DefaultCostBreakdownItem[];
  contractTerms: BidContractTerms;
}

export interface ContractorCoveragePreview {
  locationLabel: string;
  projectTags: Array<{ slug: string; label: string }>;
  contractorCount: number;
  multipleTrades: boolean;
  suggestSplitProject: boolean;
}

export interface UpdateTenderDeadlineDto {
  applicationsCloseAt?: string;
  noApplicationsDeadline?: boolean;
}

export const DEFAULT_TENDER_DURATION_DAYS = 7;
