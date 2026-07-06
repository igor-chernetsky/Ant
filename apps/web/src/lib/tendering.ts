import { fetchWithAuth } from './auth-client';

export type { ClarificationAttachment } from './clarification-attachments';
import type { ClarificationAttachment } from './clarification-attachments';

export type TenderStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'awarded'
  | 'cancelled';

export type BidStatus =
  | 'clarifying'
  | 'enrolled'
  | 'submitted'
  | 'withdrawn'
  | 'selected'
  | 'rejected';

export interface BidLineItem {
  trade: string;
  description?: string;
  amount: number;
}

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
  specialConditions?: string;
}

export interface BidTerms {
  notes?: string;
  approach?: string;
  scopeSummary?: string;
  lineItems?: BidLineItem[];
  contractTerms?: BidContractTerms;
}

export interface Bid {
  id: string;
  tenderId: string;
  contractorId: string;
  companyName: string | null;
  status: BidStatus;
  contenderNumber: number | null;
  enrolledAt: string | null;
  amount: string | null;
  durationDays: number | null;
  terms: BidTerms | null;
  submittedAt: string | null;
}

export interface DefaultCostBreakdownItem {
  trade: string;
  description?: string;
}

export interface Tender {
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
  bids: Bid[];
  applicationCount: number;
  submittedBidCount: number;
  defaultCostBreakdown: DefaultCostBreakdownItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ContractorProfile {
  id: string;
  userId: string;
  companyName: string | null;
  regionCode: string;
  serviceLocations: Array<{ regionSlug: string; areaSlug?: string }>;
  projectTypes: string[];
  tagSlugs: string[];
  verificationStatus: string;
  verificationComment: string | null;
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  createdAt: string;
}

export type ClarificationMode = 'open_chat' | 'structured_qa';

export interface ClarificationQuestion {
  id: string;
  questionText: string;
  sortOrder: number;
  answer: string | null;
  answeredAt: string | null;
  sourceBidIds: string[];
  askedByCount: number;
  attachments: ClarificationAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface ClarificationQuestionsList {
  questions: ClarificationQuestion[];
  fullyAnsweredContractorCount: number;
  totalContractorCount: number;
}

function computeClarificationContractorStats(
  questions: ClarificationQuestion[],
): Pick<
  ClarificationQuestionsList,
  'fullyAnsweredContractorCount' | 'totalContractorCount'
> {
  const bidIds = new Set<string>();
  for (const question of questions) {
    for (const bidId of question.sourceBidIds) {
      bidIds.add(bidId);
    }
  }

  let fullyAnsweredContractorCount = 0;
  for (const bidId of bidIds) {
    const relevant = questions.filter((question) =>
      question.sourceBidIds.includes(bidId),
    );
    if (
      relevant.length > 0 &&
      relevant.every((question) => question.answer?.trim())
    ) {
      fullyAnsweredContractorCount += 1;
    }
  }

  return {
    fullyAnsweredContractorCount,
    totalContractorCount: bidIds.size,
  };
}

export interface PublishTenderOptions {
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

export interface ContractorProjectParticipation {
  tenderId: string | null;
  tenderStatus: TenderStatus | null;
  closesAt: string | null;
  applicationsDeadlinePassed?: boolean;
  myBid: Bid | null;
  verificationStatus: string;
  clarificationMode: ClarificationMode;
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
  canWithdraw: boolean;
  accessDenied: boolean;
  projectStatus: string;
}

export interface BidOffer {
  id: string;
  bidId: string;
  authorRole: 'client' | 'contractor';
  authorId: string;
  amount: string;
  durationDays: number | null;
  terms: BidTerms | null;
  note: string | null;
  createdAt: string;
}

export interface ContractorApplicationItem {
  bidId: string;
  tenderId: string;
  projectId: string;
  projectTitle: string;
  projectDistrict: string | null;
  projectStatus: string;
  projectType: string;
  description: string | null;
  coverImageUrl: string | null;
  tenderStatus: TenderStatus;
  bidStatus: BidStatus;
  contenderNumber: number | null;
  bidAmount: string | null;
  submittedAt: string | null;
  isActiveProject: boolean;
}

export interface BidMessage {
  id: string;
  bidId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface ContractorTenderView {
  tender: Tender;
  myBid: Bid | null;
}

async function parseError(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const message = body?.message;
  if (Array.isArray(message)) {
    throw new Error(message.join(', '));
  }
  throw new Error(
    typeof message === 'string' ? message : fallback,
  );
}

export async function fetchProjectTender(
  projectId: string,
): Promise<Tender | null> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load tender');
  }
  const data = (await response.json()) as Tender | { tender: null } | null;
  if (!data || typeof data !== 'object') {
    return null;
  }
  if ('tender' in data && data.tender === null && !('id' in data)) {
    return null;
  }
  if (!('id' in data)) {
    return null;
  }
  const tender = data as Tender;
  return {
    ...tender,
    bids: Array.isArray(tender.bids) ? tender.bids : [],
    defaultCostBreakdown: Array.isArray(tender.defaultCostBreakdown)
      ? tender.defaultCostBreakdown
      : [],
  };
}

export async function createProjectTender(
  projectId: string,
  options?: PublishTenderOptions,
): Promise<Tender> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options ?? {}),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to create tender');
  }
  return response.json() as Promise<Tender>;
}

export async function startProjectTender(
  projectId: string,
  options?: PublishTenderOptions,
): Promise<Tender> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/start`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options ?? {}),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to start tender');
  }
  return response.json() as Promise<Tender>;
}

export async function fetchTenderPublishPreview(
  projectId: string,
): Promise<TenderPublishPreview> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/publish-preview`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load publish preview');
  }
  return response.json() as Promise<TenderPublishPreview>;
}

export async function fetchContractorCoverage(
  projectId: string,
): Promise<ContractorCoveragePreview> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/contractor-coverage`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load contractor coverage');
  }
  return response.json() as Promise<ContractorCoveragePreview>;
}

export async function updateTenderDeadline(
  projectId: string,
  options: PublishTenderOptions,
): Promise<Tender> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/deadline`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to update application deadline');
  }
  return response.json() as Promise<Tender>;
}

export async function revertProjectTender(projectId: string): Promise<void> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/revert`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to revert tender');
  }
}

export async function fetchClarificationQuestions(
  projectId: string,
): Promise<ClarificationQuestionsList> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/clarification-questions`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load clarification questions');
  }
  const data = (await response.json()) as
    | ClarificationQuestionsList
    | ClarificationQuestion[];

  if (Array.isArray(data)) {
    return {
      questions: data,
      ...computeClarificationContractorStats(data),
    };
  }

  return {
    questions: data.questions ?? [],
    fullyAnsweredContractorCount: data.fullyAnsweredContractorCount ?? 0,
    totalContractorCount: data.totalContractorCount ?? 0,
  };
}

export async function answerClarificationQuestion(
  projectId: string,
  questionId: string,
  answer: string,
): Promise<ClarificationQuestion> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/clarification-questions/${encodeURIComponent(questionId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to save answer');
  }
  return response.json() as Promise<ClarificationQuestion>;
}

export async function fetchBidClarificationSubmission(
  bidId: string,
): Promise<{ questions: string[]; submittedAt: string } | null> {
  const response = await fetchWithAuth(
    `/api/contractor/bids/${encodeURIComponent(bidId)}/clarification-questions`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load your question list');
  }
  const data = (await response.json()) as
    | { questions: string[]; submittedAt: string }
    | { submission: null };
  if ('submission' in data && data.submission === null) {
    return null;
  }
  return data as { questions: string[]; submittedAt: string };
}

export async function submitBidClarificationQuestions(
  bidId: string,
  questions: string[],
): Promise<{ questions: string[]; submittedAt: string }> {
  const response = await fetchWithAuth(
    `/api/contractor/bids/${encodeURIComponent(bidId)}/clarification-questions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to submit questions');
  }
  return response.json() as Promise<{ questions: string[]; submittedAt: string }>;
}

export async function selectProjectBid(
  projectId: string,
  bidId: string,
): Promise<Tender> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/bids/${encodeURIComponent(bidId)}/select`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to select bid');
  }
  return response.json() as Promise<Tender>;
}

export async function updateBidContractTerms(
  projectId: string,
  bidId: string,
  contractTerms: BidContractTerms,
): Promise<Bid> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/bids/${encodeURIComponent(bidId)}/contract-terms`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractTerms }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to update contract terms');
  }
  return response.json() as Promise<Bid>;
}

export async function fetchContractorProfile(): Promise<ContractorProfile | null> {
  const response = await fetchWithAuth('/api/contractor/profile', {
  });
  if (!response.ok) {
    await parseError(response, 'Failed to load contractor profile');
  }
  const data = (await response.json()) as ContractorProfile | { profile: null };
  if ('profile' in data && data.profile === null) {
    return null;
  }
  return data as ContractorProfile;
}

export async function upsertContractorProfile(input: {
  companyName?: string;
  regionCode?: string;
  serviceLocations?: Array<{ regionSlug: string; areaSlug?: string }>;
  tagSlugs?: string[];
}): Promise<ContractorProfile> {
  const response = await fetchWithAuth('/api/contractor/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to save contractor profile');
  }
  return response.json() as Promise<ContractorProfile>;
}

export async function fetchContractorProjectParticipation(
  projectId: string,
): Promise<ContractorProjectParticipation | null> {
  const response = await fetchWithAuth(
    `/api/contractor/projects/${encodeURIComponent(projectId)}/participation`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load contractor participation');
  }
  const data = (await response.json()) as
    | ContractorProjectParticipation
    | { participation: null };
  if ('participation' in data && data.participation === null) {
    return null;
  }
  const participation = data as ContractorProjectParticipation;
  return {
    ...participation,
    defaultCostBreakdown: Array.isArray(participation.defaultCostBreakdown)
      ? participation.defaultCostBreakdown
      : [],
  };
}

export async function fetchContractorTender(
  tenderId: string,
): Promise<ContractorTenderView> {
  const response = await fetchWithAuth(
    `/api/contractor/tenders/${encodeURIComponent(tenderId)}`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load tender');
  }
  return response.json() as Promise<ContractorTenderView>;
}

export async function startContractorClarification(
  tenderId: string,
): Promise<Bid> {
  const response = await fetchWithAuth(
    `/api/contractor/tenders/${encodeURIComponent(tenderId)}/clarify`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to start clarification');
  }
  return response.json() as Promise<Bid>;
}

export async function enrollContractorInTender(
  tenderId: string,
): Promise<Bid> {
  const response = await fetchWithAuth(
    `/api/contractor/tenders/${encodeURIComponent(tenderId)}/enroll`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to enroll in tender');
  }
  return response.json() as Promise<Bid>;
}

export async function fetchBidCounterOffers(
  projectId: string,
  bidId: string,
): Promise<BidOffer[]> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/bids/${encodeURIComponent(bidId)}/counter-offers`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load counter-offers');
  }
  return response.json() as Promise<BidOffer[]>;
}

export async function submitClientCounterOffer(
  projectId: string,
  bidId: string,
  input: {
    amount: number;
    durationDays?: number;
    notes?: string;
    approach?: string;
    scopeSummary?: string;
    lineItems?: BidLineItem[];
  },
): Promise<BidOffer> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/bids/${encodeURIComponent(bidId)}/counter-offers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to submit counter-offer');
  }
  return response.json() as Promise<BidOffer>;
}

export async function submitContractorBid(
  tenderId: string,
  input: {
    amount: number;
    durationDays?: number;
    notes?: string;
    approach?: string;
    scopeSummary?: string;
    lineItems?: BidLineItem[];
    contractTerms?: BidContractTerms;
  },
): Promise<Bid> {
  const response = await fetchWithAuth(
    `/api/contractor/tenders/${encodeURIComponent(tenderId)}/bids`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to submit bid');
  }
  return response.json() as Promise<Bid>;
}

export async function fetchContractorApplications(): Promise<
  ContractorApplicationItem[]
> {
  const response = await fetchWithAuth('/api/contractor/applications');
  if (!response.ok) {
    await parseError(response, 'Failed to load applications');
  }
  return response.json() as Promise<ContractorApplicationItem[]>;
}

export interface ContractorReviewItem {
  id: string;
  projectId: string;
  projectTitle: string;
  comment: string | null;
  ratings: Record<string, number>;
  averageRating: number;
  createdAt: string;
  clientName: string | null;
}

export async function fetchContractorReviews(): Promise<ContractorReviewItem[]> {
  const response = await fetchWithAuth('/api/contractor/reviews');
  if (!response.ok) {
    await parseError(response, 'Failed to load reviews');
  }
  return response.json() as Promise<ContractorReviewItem[]>;
}

/** @deprecated Use fetchContractorApplications */
export async function fetchContractorInvitations(): Promise<
  ContractorApplicationItem[]
> {
  return fetchContractorApplications();
}

export async function fetchBidMessages(
  bidId: string,
  projectId?: string,
): Promise<BidMessage[]> {
  const path = projectId
    ? `/api/projects/${encodeURIComponent(projectId)}/tender/bids/${encodeURIComponent(bidId)}/messages`
    : `/api/contractor/bids/${encodeURIComponent(bidId)}/messages`;
  const response = await fetchWithAuth(path);
  if (!response.ok) {
    await parseError(response, 'Failed to load messages');
  }
  return response.json() as Promise<BidMessage[]>;
}

export async function sendBidMessage(
  bidId: string,
  body: string,
  projectId?: string,
): Promise<BidMessage> {
  const path = projectId
    ? `/api/projects/${encodeURIComponent(projectId)}/tender/bids/${encodeURIComponent(bidId)}/messages`
    : `/api/contractor/bids/${encodeURIComponent(bidId)}/messages`;
  const response = await fetchWithAuth(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to send message');
  }
  return response.json() as Promise<BidMessage>;
}

const BID_CHAT_PRESENCE_INTERVAL_MS = 30_000;

export function touchBidChatPresence(
  bidId: string,
  projectId?: string,
): void {
  const path = projectId
    ? `/api/projects/${encodeURIComponent(projectId)}/tender/bids/${encodeURIComponent(bidId)}/presence`
    : `/api/contractor/bids/${encodeURIComponent(bidId)}/presence`;
  void fetchWithAuth(path, { method: 'PUT' }).catch(() => {
    /* presence is best-effort */
  });
}

export { BID_CHAT_PRESENCE_INTERVAL_MS };

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] ?? null;
}

export async function downloadCommercialProposal(
  bidId: string,
  projectId?: string,
): Promise<void> {
  const path = projectId
    ? `/api/projects/${encodeURIComponent(projectId)}/tender/bids/${encodeURIComponent(bidId)}/commercial-proposal`
    : `/api/contractor/bids/${encodeURIComponent(bidId)}/commercial-proposal`;

  const response = await fetchWithAuth(path);
  if (!response.ok) {
    await parseError(response, 'Failed to download contract draft');
  }

  const blob = await response.blob();
  const fileName =
    parseContentDispositionFilename(
      response.headers.get('content-disposition'),
    ) ?? `contract-draft-${bidId.slice(0, 8)}.pdf`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function withdrawContractorBid(tenderId: string): Promise<Bid> {
  const response = await fetchWithAuth(
    `/api/contractor/tenders/${encodeURIComponent(tenderId)}/bids`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to withdraw bid');
  }
  return response.json() as Promise<Bid>;
}

export function formatContractorParticipationLabel(
  application: ContractorApplicationItem,
): string {
  if (application.projectStatus === 'completed') {
    return application.bidStatus === 'selected'
      ? 'Completed project'
      : 'Project completed';
  }
  if (application.isActiveProject || application.bidStatus === 'selected') {
    return 'Active project';
  }
  if (application.bidStatus === 'clarifying') {
    return 'Clarifying scope';
  }
  if (application.bidStatus === 'enrolled') {
    return application.contenderNumber != null
      ? `Contender #${application.contenderNumber}`
      : 'Enrolled';
  }
  if (application.bidStatus === 'submitted') {
    return 'Proposal submitted';
  }
  if (application.bidStatus === 'rejected') {
    return 'Not selected';
  }
  return application.bidStatus.replaceAll('_', ' ');
}

export function formatTenderStatus(status: TenderStatus): string {
  return status.replaceAll('_', ' ');
}

export function isTenderEligibleProjectStatus(status: string): boolean {
  return [
    'estimated',
    'in_tender',
    'awarded',
  ].includes(status);
}

export interface BidAnalysisComparison {
  bidId: string;
  companyName: string | null;
  strengths: string[];
  weaknesses: string[];
  riskFlags: string[];
}

export interface BidAnalysisResult {
  recommendedBidId: string | null;
  recommendedCompanyName: string | null;
  summary: string;
  reasoning: string;
  comparisons: BidAnalysisComparison[];
  confidence: number;
  provider: 'openai' | 'fallback';
}

export interface BidAnalysisState {
  analysis: BidAnalysisResult | null;
  fingerprint: string;
  generatedAt: string | null;
  canAnalyze: boolean;
  analysisUpToDate: boolean;
  submittedBidCount: number;
}

export async function fetchBidAnalysis(
  projectId: string,
): Promise<BidAnalysisState> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/bids/analysis`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load bid analysis');
  }
  return response.json() as Promise<BidAnalysisState>;
}

export async function runBidAnalysis(
  projectId: string,
): Promise<BidAnalysisState> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/bids/analysis`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to analyze bids');
  }
  return response.json() as Promise<BidAnalysisState>;
}
