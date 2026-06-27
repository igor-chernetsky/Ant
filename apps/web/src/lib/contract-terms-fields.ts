import type { BidContractTerms } from '@/lib/tendering';

export const DEFAULT_CONTRACT_TERMS: BidContractTerms = {
  retentionPercent: 10,
  retentionLimitPercent: 10,
  defectNotificationMonths: 24,
  advancePaymentPercent: 0,
};

export type ContractTermsAudience = 'contractor' | 'client';

export type ContractTermsFieldKey = keyof BidContractTerms;

export interface ContractTermsProjectContext {
  title?: string;
  district?: string | null;
  description?: string | null;
}

const SHARED_KEYS: ContractTermsFieldKey[] = [
  'worksStartDate',
  'contractPeriodMonths',
  'advancePaymentPercent',
  'advancePaymentAmount',
  'retentionPercent',
  'retentionLimitPercent',
  'retentionReleaseNotes',
  'defectNotificationMonths',
  'warrantyPeriodNotes',
  'delayDamagesNotes',
  'specialConditions',
];

const CLIENT_ONLY_KEYS: ContractTermsFieldKey[] = [
  'siteAddress',
  'propertyOwnership',
  'employerName',
  'employerAddress',
  'employerRegistrationNo',
];

const CONTRACTOR_ONLY_KEYS: ContractTermsFieldKey[] = [
  'subjectOfContract',
  'contractorAddress',
  'contractorRegistrationNo',
  'contractorRepresentative',
];

export function canEditContractTermField(
  key: ContractTermsFieldKey,
  audience: ContractTermsAudience,
): boolean {
  if (SHARED_KEYS.includes(key)) return true;
  if (audience === 'client') return CLIENT_ONLY_KEYS.includes(key);
  return CONTRACTOR_ONLY_KEYS.includes(key);
}

function pickKeys(
  terms: BidContractTerms,
  keys: ContractTermsFieldKey[],
): BidContractTerms {
  const picked: BidContractTerms = {};
  for (const key of keys) {
    if (terms[key] !== undefined) {
      (picked as Record<string, unknown>)[key] = terms[key];
    }
  }
  return picked;
}

export function pickContractorContractTerms(
  terms: BidContractTerms,
): BidContractTerms {
  return pickKeys(terms, [...CONTRACTOR_ONLY_KEYS, ...SHARED_KEYS]);
}

export function pickClientContractTerms(
  terms: BidContractTerms,
): BidContractTerms {
  return pickKeys(terms, [...CLIENT_ONLY_KEYS, ...SHARED_KEYS]);
}

function monthsFromDurationDays(days?: number | null): number | undefined {
  if (days == null || days < 1) return undefined;
  return Math.max(1, Math.round(days / 30));
}

export function defaultScopeSummary(
  terms?: {
    scopeSummary?: string;
    contractTerms?: BidContractTerms;
  } | null,
  project?: ContractTermsProjectContext,
): string {
  return (
    terms?.scopeSummary?.trim() ||
    terms?.contractTerms?.subjectOfContract?.trim() ||
    project?.description?.trim() ||
    (project?.title ? `Construction works for ${project.title}` : '')
  );
}

export function contractTermsFromBid(
  terms?: { contractTerms?: BidContractTerms } | null,
  project?: ContractTermsProjectContext,
  durationDays?: number | null,
): BidContractTerms {
  const existing = terms?.contractTerms ?? {};
  const defaultSubject = defaultScopeSummary(terms, project) || undefined;

  return {
    ...DEFAULT_CONTRACT_TERMS,
    ...existing,
    siteAddress: existing.siteAddress ?? project?.district ?? undefined,
    subjectOfContract: existing.subjectOfContract ?? defaultSubject,
    contractPeriodMonths:
      existing.contractPeriodMonths ?? monthsFromDurationDays(durationDays),
  };
}
