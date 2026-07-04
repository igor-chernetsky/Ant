import type { BidContractTerms } from '@/lib/tendering';
import type { ProjectBriefV1 } from '@/lib/projects';
import {
  inferContractPeriodMonths,
  inferWorksStartDate,
} from '@/lib/contract-terms-inference';

export const DEFAULT_PROPERTY_OWNERSHIP =
  'The Employer holds lawful title to the Site and right to commission the Works.';

export const DEFAULT_RETENTION_RELEASE_NOTES =
  '5% on Taking-Over Certificate; 5% after 12 months from Practical Completion.';

export const CONTRACT_TERMS_TEXT_PLACEHOLDER = 'Enter details';

export const DEFAULT_CONTRACT_TERMS: BidContractTerms = {
  retentionPercent: 10,
  retentionLimitPercent: 10,
  defectNotificationMonths: 24,
  advancePaymentPercent: 0,
  propertyOwnership: DEFAULT_PROPERTY_OWNERSHIP,
  retentionReleaseNotes: DEFAULT_RETENTION_RELEASE_NOTES,
};

export type ContractTermsAudience = 'contractor' | 'client';

export type ContractTermsFieldKey = keyof BidContractTerms;

export interface ContractTermsProjectContext {
  title?: string;
  district?: string | null;
  description?: string | null;
  brief?: ProjectBriefV1 | null;
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
    worksStartDate:
      existing.worksStartDate?.trim() || inferWorksStartDate(project?.brief),
    contractPeriodMonths:
      existing.contractPeriodMonths ??
      inferContractPeriodMonths({
        durationDays,
        brief: project?.brief,
      }),
    propertyOwnership:
      existing.propertyOwnership?.trim() || DEFAULT_PROPERTY_OWNERSHIP,
    retentionReleaseNotes:
      existing.retentionReleaseNotes?.trim() || DEFAULT_RETENTION_RELEASE_NOTES,
  };
}

export function contractTermsFromProject(input: {
  contractTerms?: BidContractTerms;
  project?: ContractTermsProjectContext;
  durationDays?: number | null;
}): BidContractTerms {
  return contractTermsFromBid(
    { contractTerms: input.contractTerms },
    input.project,
    input.durationDays,
  );
}
