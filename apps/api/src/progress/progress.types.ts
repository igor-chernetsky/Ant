export type ProgressClaimStatusDto =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected';

export interface ProgressClaimLineDto {
  id: string;
  sortOrder: number;
  trade: string;
  description: string | null;
  contractAmount: number;
  percentComplete: number;
  amountPreviouslyApproved: number;
  amountCumulative: number;
  amountPeriod: number;
}

export interface ProgressClaimDto {
  id: string;
  projectId: string;
  bidId: string;
  sequenceNumber: number;
  status: ProgressClaimStatusDto;
  note: string | null;
  rejectionReason: string | null;
  preliminaryPercent: number;
  overheadProfitPercent: number;
  vatPercent: number;
  worksCumulative: number;
  preliminaryCumulative: number;
  overheadProfitCumulative: number;
  vatCumulative: number;
  grandCumulative: number;
  worksPeriod: number;
  preliminaryPeriod: number;
  overheadProfitPeriod: number;
  vatPeriod: number;
  grandPeriod: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ProgressClaimLineDto[];
}

export interface ProgressBaselineLineDto {
  trade: string;
  description: string | null;
  contractAmount: number;
  approvedPercent: number;
  approvedAmount: number;
}

export interface ProgressOverviewDto {
  projectId: string;
  bidId: string;
  editable: boolean;
  role: 'client' | 'contractor' | null;
  contractGrandTotal: number;
  approvedGrandCumulative: number;
  remainingGrand: number;
  preliminaryPercent: number;
  overheadProfitPercent: number;
  vatPercent: number;
  baselineLines: ProgressBaselineLineDto[];
  openClaim: ProgressClaimDto | null;
  claims: ProgressClaimDto[];
}

export interface UpdateProgressClaimDto {
  note?: string | null;
  lines: Array<{
    trade: string;
    description?: string | null;
    percentComplete: number;
  }>;
}

export interface RejectProgressClaimDto {
  reason?: string;
}
