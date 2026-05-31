export type TenderStatus =
  | 'draft'
  | 'collecting_participants'
  | 'open'
  | 'closed'
  | 'awarded'
  | 'cancelled';

export type TenderInvitationStatus =
  | 'pending'
  | 'declined'
  | 'accepted'
  | 'expired';

export type BidStatus = 'submitted' | 'withdrawn' | 'selected' | 'rejected';

export interface BidTerms {
  notes?: string;
  lineItems?: Array<{
    trade: string;
    description: string;
    amount: number;
  }>;
}

export interface TenderInvitation {
  id: string;
  contractorId: string;
  companyName: string | null;
  status: TenderInvitationStatus;
  invitedAt: string;
  respondedAt: string | null;
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
  invitations: TenderInvitation[];
  bids: Bid[];
  acceptedInvitationCount: number;
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
  verificationStatus: string;
  verificationComment: string | null;
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  createdAt: string;
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

export interface ContractorTenderView {
  tender: Tender;
  invitation: TenderInvitation;
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
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/tender`,
    { credentials: 'include' },
  );
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
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
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/tender`,
    { method: 'POST', credentials: 'include' },
  );
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    await parseError(response, 'Failed to create tender');
  }
  return response.json() as Promise<Tender>;
}

export async function startProjectTender(projectId: string): Promise<Tender> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/tender/start`,
    { method: 'POST', credentials: 'include' },
  );
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    await parseError(response, 'Failed to start tender');
  }
  return response.json() as Promise<Tender>;
}

export async function selectProjectBid(
  projectId: string,
  bidId: string,
): Promise<Tender> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/tender/bids/${encodeURIComponent(bidId)}/select`,
    { method: 'POST', credentials: 'include' },
  );
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    await parseError(response, 'Failed to select bid');
  }
  return response.json() as Promise<Tender>;
}

export async function fetchContractorProfile(): Promise<ContractorProfile | null> {
  const response = await fetch('/api/contractor/profile', {
    credentials: 'include',
  });
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
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
}): Promise<ContractorProfile> {
  const response = await fetch('/api/contractor/profile', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    await parseError(response, 'Failed to save contractor profile');
  }
  return response.json() as Promise<ContractorProfile>;
}

export async function fetchContractorInvitations(): Promise<
  ContractorInvitationItem[]
> {
  const response = await fetch('/api/contractor/invitations', {
    credentials: 'include',
  });
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    await parseError(response, 'Failed to load invitations');
  }
  return response.json() as Promise<ContractorInvitationItem[]>;
}

export async function fetchContractorTender(
  tenderId: string,
): Promise<ContractorTenderView> {
  const response = await fetch(
    `/api/contractor/tenders/${encodeURIComponent(tenderId)}`,
    { credentials: 'include' },
  );
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    await parseError(response, 'Failed to load tender');
  }
  return response.json() as Promise<ContractorTenderView>;
}

export async function respondContractorInvitation(
  tenderId: string,
  accept: boolean,
): Promise<TenderInvitation> {
  const response = await fetch(
    `/api/contractor/tenders/${encodeURIComponent(tenderId)}/invitations/respond`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accept }),
    },
  );
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    await parseError(response, 'Failed to respond to invitation');
  }
  return response.json() as Promise<TenderInvitation>;
}

export async function submitContractorBid(
  tenderId: string,
  input: {
    amount: number;
    durationDays?: number;
    notes?: string;
  },
): Promise<Bid> {
  const response = await fetch(
    `/api/contractor/tenders/${encodeURIComponent(tenderId)}/bids`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    await parseError(response, 'Failed to submit bid');
  }
  return response.json() as Promise<Bid>;
}

export async function withdrawContractorBid(tenderId: string): Promise<Bid> {
  const response = await fetch(
    `/api/contractor/tenders/${encodeURIComponent(tenderId)}/bids`,
    { method: 'DELETE', credentials: 'include' },
  );
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    await parseError(response, 'Failed to withdraw bid');
  }
  return response.json() as Promise<Bid>;
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
