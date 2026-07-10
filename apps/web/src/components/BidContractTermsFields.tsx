'use client';

import { useTranslation } from '@/components/LocaleProvider';
import type { BidContractTerms } from '@/lib/tendering';
import {
  canEditContractTermField,
  CONTRACT_TERMS_TEXT_PLACEHOLDER,
  type ContractTermsAudience,
} from '@/lib/contract-terms-fields';

export { DEFAULT_CONTRACT_TERMS } from '@/lib/contract-terms-fields';
export type { ContractTermsAudience } from '@/lib/contract-terms-fields';
export {
  contractTermsFromBid,
  defaultScopeSummary,
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
  hideSubjectOfContract?: boolean;
  showSectionHeader?: boolean;
}

export function BidContractTermsFields({
  value,
  onChange,
  audience = 'contractor',
  projectTitle,
  projectDistrict,
  disabled = false,
  hideSubjectOfContract = false,
  showSectionHeader = true,
}: BidContractTermsFieldsProps) {
  const { t } = useTranslation();

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
      {showSectionHeader && (
        <div className="bid-contract-terms-header">
          <p className="tag-section-label">{t('contractTerms.sectionTitle')}</p>
          <p className="muted bid-contract-terms-hint">
            {audience === 'client'
              ? t('contractTerms.clientHint')
              : t('contractTerms.contractorHint')}
          </p>
        </div>
      )}

      <div className="modal-form bid-proposal-form-fields bid-contract-terms-fields">
        {!hideSubjectOfContract && (
          <label>
            {t('contractTerms.subjectOfContract')}
            <span className="field-hint muted">
              {t('contractTerms.subjectHint')}
            </span>
            <textarea
              rows={2}
              disabled={fieldDisabled('subjectOfContract')}
              value={value.subjectOfContract ?? ''}
              placeholder={
                projectTitle
                  ? t('contractTerms.subjectPlaceholderProject', {
                      title: projectTitle,
                    })
                  : t('contractTerms.subjectPlaceholder')
              }
              onChange={(e) => set('subjectOfContract', e.target.value)}
            />
          </label>
        )}

        <label>
          {t('contractTerms.siteAddress')}
          <input
            type="text"
            disabled={fieldDisabled('siteAddress')}
            value={value.siteAddress ?? ''}
            placeholder={
              projectDistrict ?? t('contractTerms.siteAddressPlaceholder')
            }
            onChange={(e) => set('siteAddress', e.target.value)}
          />
        </label>

        <label>
          {t('contractTerms.propertyOwnership')}
          <span className="field-hint muted">
            {t('contractTerms.propertyOwnershipHint')}
          </span>
          <textarea
            rows={2}
            disabled={fieldDisabled('propertyOwnership')}
            value={value.propertyOwnership ?? ''}
            placeholder={CONTRACT_TERMS_TEXT_PLACEHOLDER}
            onChange={(e) => set('propertyOwnership', e.target.value)}
          />
        </label>

        <div className="bid-proposal-form-row bid-proposal-form-row--pair">
          <label className="bid-proposal-field">
            <span className="field-label">{t('contractTerms.worksStartDate')}</span>
            <input
              type="date"
              disabled={fieldDisabled('worksStartDate')}
              value={value.worksStartDate ?? ''}
              onChange={(e) => set('worksStartDate', e.target.value)}
            />
          </label>
          <label className="bid-proposal-field">
            <span className="field-label">
              {t('contractTerms.contractPeriodMonths')}
            </span>
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
            <span className="field-label">
              {t('contractTerms.advancePaymentPercent')}
            </span>
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
            <span className="field-label">{t('contractTerms.fixedAdvanceThb')}</span>
            <input
              type="number"
              min="0"
              disabled={fieldDisabled('advancePaymentAmount')}
              value={value.advancePaymentAmount ?? ''}
              placeholder={t('common.optional')}
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
            <span className="field-label">{t('contractTerms.retentionPercent')}</span>
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
            <span className="field-label">
              {t('contractTerms.retentionCapPercent')}
            </span>
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
            <span className="field-label">{t('contractTerms.warrantyMonths')}</span>
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
          {t('contractTerms.retentionReleaseSchedule')}
          <textarea
            rows={2}
            disabled={fieldDisabled('retentionReleaseNotes')}
            value={value.retentionReleaseNotes ?? ''}
            placeholder={CONTRACT_TERMS_TEXT_PLACEHOLDER}
            onChange={(e) => set('retentionReleaseNotes', e.target.value)}
          />
        </label>

        <label>
          {t('contractTerms.warrantyPeriodNotes')}
          <span className="field-hint muted">
            {t('contractTerms.warrantyPeriodNotesHint')}
          </span>
          <textarea
            rows={2}
            disabled={fieldDisabled('warrantyPeriodNotes')}
            value={value.warrantyPeriodNotes ?? ''}
            placeholder={t('contractTerms.warrantyPeriodPlaceholder', {
              months: value.defectNotificationMonths ?? 24,
            })}
            onChange={(e) => set('warrantyPeriodNotes', e.target.value)}
          />
        </label>

        <label>
          {t('contractTerms.delayDamages')}
          <span className="field-hint muted">{t('contractTerms.delayDamagesHint')}</span>
          <textarea
            rows={2}
            disabled={fieldDisabled('delayDamagesNotes')}
            value={value.delayDamagesNotes ?? ''}
            placeholder={t('contractTerms.delayDamagesPlaceholder')}
            onChange={(e) => set('delayDamagesNotes', e.target.value)}
          />
        </label>

        <label>
          {t('contractTerms.specialConditions')}
          <span className="field-hint muted">
            {t('contractTerms.specialConditionsHint')}
          </span>
          <textarea
            rows={4}
            disabled={fieldDisabled('specialConditions')}
            value={value.specialConditions ?? ''}
            placeholder={t('contractTerms.specialConditionsPlaceholder')}
            onChange={(e) => set('specialConditions', e.target.value)}
          />
        </label>

        {audience === 'client' && (
          <>
            <p className="tag-section-label bid-contract-terms-legal-label">
              {t('contractTerms.employerLegalDetails')}
            </p>
            <label>
              {t('contractTerms.employerLegalName')}
              <input
                type="text"
                disabled={fieldDisabled('employerName')}
                value={value.employerName ?? ''}
                onChange={(e) => set('employerName', e.target.value)}
              />
            </label>
            <label>
              {t('contractTerms.employerAddress')}
              <input
                type="text"
                disabled={fieldDisabled('employerAddress')}
                value={value.employerAddress ?? ''}
                onChange={(e) => set('employerAddress', e.target.value)}
              />
            </label>
            <label>
              {t('contractTerms.employerRegistrationNo')}
              <input
                type="text"
                disabled={fieldDisabled('employerRegistrationNo')}
                value={value.employerRegistrationNo ?? ''}
                onChange={(e) => set('employerRegistrationNo', e.target.value)}
              />
            </label>
          </>
        )}

        {audience === 'contractor' && (
          <>
            <p className="tag-section-label bid-contract-terms-legal-label">
              {t('contractTerms.contractorLegalDetails')}
            </p>
            <label>
              {t('contractTerms.contractorAddress')}
              <input
                type="text"
                disabled={fieldDisabled('contractorAddress')}
                value={value.contractorAddress ?? ''}
                onChange={(e) => set('contractorAddress', e.target.value)}
              />
            </label>
            <label>
              {t('contractTerms.contractorRegistrationNo')}
              <input
                type="text"
                disabled={fieldDisabled('contractorRegistrationNo')}
                value={value.contractorRegistrationNo ?? ''}
                onChange={(e) =>
                  set('contractorRegistrationNo', e.target.value)
                }
              />
            </label>
            <label>
              {t('contractTerms.contractorRepresentative')}
              <input
                type="text"
                disabled={fieldDisabled('contractorRepresentative')}
                value={value.contractorRepresentative ?? ''}
                onChange={(e) =>
                  set('contractorRepresentative', e.target.value)
                }
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
