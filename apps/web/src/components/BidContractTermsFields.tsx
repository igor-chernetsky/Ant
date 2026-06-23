'use client';

import type { BidContractTerms } from '@/lib/tendering';
import {
  canEditContractTermField,
  type ContractTermsAudience,
} from '@/lib/contract-terms-fields';

export { DEFAULT_CONTRACT_TERMS } from '@/lib/contract-terms-fields';
export type { ContractTermsAudience } from '@/lib/contract-terms-fields';
export {
  contractTermsFromBid,
  pickClientContractTerms,
  pickContractorContractTerms,
} from '@/lib/contract-terms-fields';

interface BidContractTermsFieldsProps {
  value: BidContractTerms;
  onChange: (next: BidContractTerms) => void;
  audience?: ContractTermsAudience;
  projectTitle?: string;
  projectDistrict?: string | null;
  disabled?: boolean;
}

export function BidContractTermsFields({
  value,
  onChange,
  audience = 'contractor',
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

  const fieldDisabled = (key: keyof BidContractTerms) =>
    disabled || !canEditContractTermField(key, audience);

  return (
    <div className="bid-contract-terms">
      <div className="bid-contract-terms-header">
        <p className="tag-section-label">Commercial proposal document</p>
        <p className="muted bid-contract-terms-hint">
          {audience === 'contractor'
            ? 'Fields filled by the client are shown for reference. Site address and employer details come from the project.'
            : 'Propose changes to payment and schedule terms. Contractor proposal fields are shown for reference.'}
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
            disabled={fieldDisabled('subjectOfContract')}
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
            disabled={fieldDisabled('siteAddress')}
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
            disabled={fieldDisabled('propertyOwnership')}
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
              disabled={fieldDisabled('worksStartDate')}
              value={value.worksStartDate ?? ''}
              onChange={(e) => set('worksStartDate', e.target.value)}
            />
          </label>
          <label className="bid-proposal-field">
            <span className="field-label">Contract period (months)</span>
            <input
              type="number"
              min="1"
              disabled={fieldDisabled('contractPeriodMonths')}
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
              disabled={fieldDisabled('advancePaymentPercent')}
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
              disabled={fieldDisabled('advancePaymentAmount')}
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
              disabled={fieldDisabled('retentionPercent')}
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
              disabled={fieldDisabled('retentionLimitPercent')}
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
              disabled={fieldDisabled('defectNotificationMonths')}
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
            disabled={fieldDisabled('retentionReleaseNotes')}
            value={value.retentionReleaseNotes ?? ''}
            placeholder="5% on Taking-Over Certificate; 5% after 12 months from Practical Completion."
            onChange={(e) => set('retentionReleaseNotes', e.target.value)}
          />
        </label>

        <label>
          Special conditions
          <span className="field-hint muted">
            Optional — included in the commercial proposal document when filled
          </span>
          <textarea
            rows={4}
            disabled={fieldDisabled('specialConditions')}
            value={value.specialConditions ?? ''}
            placeholder="Any additional terms, exclusions, or party-specific arrangements…"
            onChange={(e) => set('specialConditions', e.target.value)}
          />
        </label>

        <details className="bid-contract-terms-advanced">
          <summary>Employer &amp; contractor legal details (optional)</summary>
          <div className="bid-contract-terms-advanced-body modal-form bid-proposal-form-fields">
            <label>
              Employer legal name
              <input
                type="text"
                disabled={fieldDisabled('employerName')}
                value={value.employerName ?? ''}
                onChange={(e) => set('employerName', e.target.value)}
              />
            </label>
            <label>
              Employer address
              <input
                type="text"
                disabled={fieldDisabled('employerAddress')}
                value={value.employerAddress ?? ''}
                onChange={(e) => set('employerAddress', e.target.value)}
              />
            </label>
            <label>
              Employer registration no.
              <input
                type="text"
                disabled={fieldDisabled('employerRegistrationNo')}
                value={value.employerRegistrationNo ?? ''}
                onChange={(e) =>
                  set('employerRegistrationNo', e.target.value)
                }
              />
            </label>
            <label>
              Contractor address
              <input
                type="text"
                disabled={fieldDisabled('contractorAddress')}
                value={value.contractorAddress ?? ''}
                onChange={(e) => set('contractorAddress', e.target.value)}
              />
            </label>
            <label>
              Contractor registration no.
              <input
                type="text"
                disabled={fieldDisabled('contractorRegistrationNo')}
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
                disabled={fieldDisabled('contractorRepresentative')}
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
