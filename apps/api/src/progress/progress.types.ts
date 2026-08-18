export type ProgressClaimStatusDto =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected';

export interface ProgressPaymentSlipDto {
  documentId: string;
  originalName: string;
  uploadedAt: string;
}

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
  retentionPercent: number;
  retentionPeriod: number;
  payablePeriod: number;
  paymentSlip: ProgressPaymentSlipDto | null;
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
  retentionPercent: number;
  retentionLimitPercent: number;
  retentionHeldToDate: number;
  advancePaymentPercent: number;
  advancePaymentAmount: number;
  advancePaymentSlip: ProgressPaymentSlipDto | null;
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

export interface PaymentSlipPresignDto {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PaymentSlipCompleteDto {
  documentId: string;
}
