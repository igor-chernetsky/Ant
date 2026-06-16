import { fetchWithAuth } from './auth-client';

export type TenderStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'awarded'
  | 'cancelled';

export type BidStatus = 'submitted' | 'withdrawn' | 'selected' | 'rejected';

export interface BidLineItem {
  trade: string;
  description: string;
  amount: number;
}

export interface BidTerms {
  notes?: string;
  approach?: string;
  scopeSummary?: string;
  lineItems?: BidLineItem[];
}

export interface Bid {
  id: string;
  tenderId: string;
  contractorId: string;
  companyName: string | null;
  status: BidStatus;
  amount: string;
  durationDays: number | null;
  terms: BidTerms | null;
  submittedAt: string;
}

export interface Tender {
  id: string;
  projectId: string;
  status: TenderStatus;
  currency: string;
  minBids: number;
  opensAt: string | null;
  closesAt: string | null;
  awardedBidId: string | null;
  bids: Bid[];
  submittedBidCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContractorProfile {
  id: string;
  userId: string;
  companyName: string | null;
  regionCode: string;
  projectTypes: string[];
  tagSlugs: string[];
  verificationStatus: string;
  verificationComment: string | null;
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  createdAt: string;
}

export interface ContractorProjectParticipation {
  tenderId: string | null;
  tenderStatus: TenderStatus | null;
  closesAt: string | null;
  myBid: Bid | null;
  verificationStatus: string;
  canSubmitBid: boolean;
  projectStatus: string;
}

export interface ContractorApplicationItem {
  bidId: string;
  tenderId: string;
  projectId: string;
  projectTitle: string;
  projectDistrict: string | null;
  tenderStatus: TenderStatus;
  bidStatus: BidStatus;
  bidAmount: string | null;
  submittedAt: string;
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
  const data = (await response.json()) as Tender | { tender: null };
  if ('tender' in data && data.tender === null) {
    return null;
  }
  return data as Tender;
}

export async function createProjectTender(projectId: string): Promise<Tender> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to create tender');
  }
  return response.json() as Promise<Tender>;
}

export async function startProjectTender(projectId: string): Promise<Tender> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/start`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to start tender');
  }
  return response.json() as Promise<Tender>;
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
  return data as ContractorProjectParticipation;
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

export async function submitContractorBid(
  tenderId: string,
  input: {
    amount: number;
    durationDays?: number;
    notes?: string;
    approach?: string;
    scopeSummary?: string;
    lineItems?: BidLineItem[];
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
  if (application.bidStatus === 'selected') {
    return 'Selected';
  }
  if (application.bidStatus === 'submitted') {
    return 'Application submitted';
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
    'tender_ready',
    'in_tender',
    'contractor_selected',
  ].includes(status);
}
