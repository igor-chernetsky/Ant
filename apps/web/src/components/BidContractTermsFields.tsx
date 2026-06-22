'use client';

import type { BidContractTerms } from '@/lib/tendering';

export const DEFAULT_CONTRACT_TERMS: BidContractTerms = {
  retentionPercent: 10,
  retentionLimitPercent: 10,
  defectNotificationMonths: 24,
  advancePaymentPercent: 0,
};

interface BidContractTermsFieldsProps {
  value: BidContractTerms;
  onChange: (next: BidContractTerms) => void;
  projectTitle?: string;
  projectDistrict?: string | null;
  disabled?: boolean;
}

export function BidContractTermsFields({
  value,
  onChange,
  projectTitle,
  projectDistrict,
  disabled = false,
}: BidContractTermsFieldsProps) {
  const set = <K extends keyof BidContractTerms>(
    key: K,
    fieldValue: BidContractTerms[K],
  ) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <div className="bid-contract-terms">
      <div className="bid-contract-terms-header">
        <p className="tag-section-label">Commercial proposal document</p>
        <p className="muted bid-contract-terms-hint">
          Used to generate the downloadable commercial proposal for both
          parties.
        </p>
      </div>

      <div className="modal-form bid-proposal-form-fields bid-contract-terms-fields">
        <label>
          Subject of contract
          <span className="field-hint muted">
            Scope definition — what works are included
          </span>
          <textarea
            rows={2}
            disabled={disabled}
            value={value.subjectOfContract ?? ''}
            placeholder={
              projectTitle
                ? `Construction works for ${projectTitle}`
                : 'Construction works as per drawings and specifications'
            }
            onChange={(e) => set('subjectOfContract', e.target.value)}
          />
        </label>

        <label>
          Site address
          <input
            type="text"
            disabled={disabled}
            value={value.siteAddress ?? ''}
            placeholder={projectDistrict ?? 'Full property address'}
            onChange={(e) => set('siteAddress', e.target.value)}
          />
        </label>

        <label>
          Property ownership / site rights
          <span className="field-hint muted">
            Title deed, lease, developer consent, etc.
          </span>
          <textarea
            rows={2}
            disabled={disabled}
            value={value.propertyOwnership ?? ''}
            placeholder="The Employer holds lawful title to the Site and right to commission the Works."
            onChange={(e) => set('propertyOwnership', e.target.value)}
          />
        </label>

        <div className="bid-proposal-form-row bid-proposal-form-row--pair">
          <label className="bid-proposal-field">
            <span className="field-label">Works start date</span>
            <input
              type="date"
              disabled={disabled}
              value={value.worksStartDate ?? ''}
              onChange={(e) => set('worksStartDate', e.target.value)}
            />
          </label>
          <label className="bid-proposal-field">
            <span className="field-label">Contract period (months)</span>
            <input
              type="number"
              min="1"
              disabled={disabled}
              value={value.contractPeriodMonths ?? ''}
              placeholder="7"
              onChange={(e) =>
                set(
                  'contractPeriodMonths',
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
            />
          </label>
        </div>

        <div className="bid-proposal-form-row bid-proposal-form-row--pair">
          <label className="bid-proposal-field">
            <span className="field-label">Advance payment (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              disabled={disabled}
              value={value.advancePaymentPercent ?? ''}
              placeholder="0"
              onChange={(e) =>
                set(
                  'advancePaymentPercent',
                  e.target.value === '' ? undefined : Number(e.target.value),
                )
              }
            />
          </label>
          <label className="bid-proposal-field">
            <span className="field-label">Fixed advance (THB)</span>
            <input
              type="number"
              min="0"
              disabled={disabled}
              value={value.advancePaymentAmount ?? ''}
              placeholder="Optional"
              onChange={(e) =>
                set(
                  'advancePaymentAmount',
                  e.target.value === '' ? undefined : Number(e.target.value),
                )
              }
            />
          </label>
        </div>

        <div className="bid-proposal-form-row bid-proposal-form-row--triple">
          <label className="bid-proposal-field">
            <span className="field-label">Retention (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              disabled={disabled}
              value={value.retentionPercent ?? 10}
              onChange={(e) =>
                set('retentionPercent', Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="bid-proposal-field">
            <span className="field-label">Retention cap (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              disabled={disabled}
              value={value.retentionLimitPercent ?? 10}
              onChange={(e) =>
                set('retentionLimitPercent', Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="bid-proposal-field">
            <span className="field-label">Warranty (months)</span>
            <input
              type="number"
              min="0"
              disabled={disabled}
              value={value.defectNotificationMonths ?? 24}
              onChange={(e) =>
                set('defectNotificationMonths', Number(e.target.value) || 0)
              }
            />
          </label>
        </div>

        <label>
          Retention release schedule
          <textarea
            rows={2}
            disabled={disabled}
            value={value.retentionReleaseNotes ?? ''}
            placeholder="5% on Taking-Over Certificate; 5% after 12 months from Practical Completion."
            onChange={(e) => set('retentionReleaseNotes', e.target.value)}
          />
        </label>

        <details className="bid-contract-terms-advanced">
          <summary>Employer &amp; contractor legal details (optional)</summary>
          <div className="bid-contract-terms-advanced-body modal-form bid-proposal-form-fields">
            <label>
              Employer legal name
              <input
                type="text"
                disabled={disabled}
                value={value.employerName ?? ''}
                onChange={(e) => set('employerName', e.target.value)}
              />
            </label>
            <label>
              Employer address
              <input
                type="text"
                disabled={disabled}
                value={value.employerAddress ?? ''}
                onChange={(e) => set('employerAddress', e.target.value)}
              />
            </label>
            <label>
              Employer registration no.
              <input
                type="text"
                disabled={disabled}
                value={value.employerRegistrationNo ?? ''}
                onChange={(e) => set('employerRegistrationNo', e.target.value)}
              />
            </label>
            <label>
              Contractor address
              <input
                type="text"
                disabled={disabled}
                value={value.contractorAddress ?? ''}
                onChange={(e) => set('contractorAddress', e.target.value)}
              />
            </label>
            <label>
              Contractor registration no.
              <input
                type="text"
                disabled={disabled}
                value={value.contractorRegistrationNo ?? ''}
                onChange={(e) =>
                  set('contractorRegistrationNo', e.target.value)
                }
              />
            </label>
            <label className="bid-contract-terms-advanced-span">
              Contractor representative
              <input
                type="text"
                disabled={disabled}
                value={value.contractorRepresentative ?? ''}
                onChange={(e) =>
                  set('contractorRepresentative', e.target.value)
                }
              />
            </label>
          </div>
        </details>
      </div>
    </div>
  );
}

export function contractTermsFromBid(
  terms?: { contractTerms?: BidContractTerms } | null,
  project?: { title?: string; district?: string | null },
): BidContractTerms {
  const existing = terms?.contractTerms ?? {};
  return {
    ...DEFAULT_CONTRACT_TERMS,
    siteAddress: existing.siteAddress ?? project?.district ?? undefined,
    subjectOfContract:
      existing.subjectOfContract ??
      (project?.title ? `Construction works for ${project.title}` : undefined),
    ...existing,
  };
}
