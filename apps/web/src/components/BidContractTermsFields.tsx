'use client';

import { useMemo } from 'react';
import { ContractTermsTextOptionField } from '@/components/ContractTermsTextOptionField';
import { useTranslation } from '@/components/LocaleProvider';
import type { BidContractTerms } from '@/lib/tendering';
import {
  canEditContractTermField,
  type ContractTermsAudience,
} from '@/lib/contract-terms-fields';
import {
  calendarDaysBetween,
  monthsFromDurationDays,
} from '@/lib/contract-terms-inference';
import {
  buildDelayDamagesOptions,
  buildPropertyOwnershipOptions,
  buildRetentionReleaseOptions,
  buildSiteAddressOptions,
  buildSpecialConditionsOptions,
  buildSubjectOfContractOptions,
  buildWarrantyPeriodOptions,
} from '@/lib/contract-terms-options';

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
  const warrantyMonths = value.defectNotificationMonths ?? 24;

  const subjectOptions = useMemo(
    () => buildSubjectOfContractOptions(t, projectTitle),
    [t, projectTitle],
  );
  const siteAddressOptions = useMemo(
    () => buildSiteAddressOptions(t, projectDistrict),
    [t, projectDistrict],
  );
  const propertyOwnershipOptions = useMemo(
    () => buildPropertyOwnershipOptions(t),
    [t],
  );
  const retentionReleaseOptions = useMemo(
    () => buildRetentionReleaseOptions(t),
    [t],
  );
  const warrantyPeriodOptions = useMemo(
    () => buildWarrantyPeriodOptions(t, warrantyMonths),
    [t, warrantyMonths],
  );
  const delayDamagesOptions = useMemo(
    () => buildDelayDamagesOptions(t),
    [t],
  );
  const specialConditionsOptions = useMemo(
    () => buildSpecialConditionsOptions(t),
    [t],
  );

  const set = <K extends keyof BidContractTerms>(
    key: K,
    fieldValue: BidContractTerms[K],
  ) => {
    onChange({ ...value, [key]: fieldValue });
  };

  const setSchedule = (patch: Partial<BidContractTerms>) => {
    const next = { ...value, ...patch };
    const days = calendarDaysBetween(next.worksStartDate, next.worksFinishDate);
    onChange({
      ...next,
      contractPeriodMonths:
        days != null ? monthsFromDurationDays(days) : next.contractPeriodMonths,
    });
  };

  const contractPeriodDays = calendarDaysBetween(
    value.worksStartDate,
    value.worksFinishDate,
  );

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
          <ContractTermsTextOptionField
            label={
              <>
                {t('contractTerms.subjectOfContract')}
                <span className="field-hint muted">
                  {t('contractTerms.subjectHint')}
                </span>
              </>
            }
            value={value.subjectOfContract ?? ''}
            onChange={(next) => set('subjectOfContract', next)}
            options={subjectOptions}
            disabled={fieldDisabled('subjectOfContract')}
            rows={2}
          />
        )}

        <ContractTermsTextOptionField
          label={t('contractTerms.siteAddress')}
          value={value.siteAddress ?? ''}
          onChange={(next) => set('siteAddress', next)}
          options={siteAddressOptions}
          disabled={fieldDisabled('siteAddress')}
          multiline={false}
          customPlaceholder={t('contractTerms.siteAddressPlaceholder')}
        />

        <ContractTermsTextOptionField
          label={
            <>
              {t('contractTerms.propertyOwnership')}
              <span className="field-hint muted">
                {t('contractTerms.propertyOwnershipHint')}
              </span>
            </>
          }
          value={value.propertyOwnership ?? ''}
          onChange={(next) => set('propertyOwnership', next)}
          options={propertyOwnershipOptions}
          disabled={fieldDisabled('propertyOwnership')}
          rows={2}
        />

        <div className="bid-proposal-form-row bid-proposal-form-row--triple">
          <label className="bid-proposal-field">
            <span className="field-label">{t('contractTerms.worksStartDate')}</span>
            <input
              type="date"
              disabled={fieldDisabled('worksStartDate')}
              value={value.worksStartDate ?? ''}
              onChange={(e) =>
                setSchedule({ worksStartDate: e.target.value || undefined })
              }
            />
          </label>
          <label className="bid-proposal-field">
            <span className="field-label">
              {t('contractTerms.worksFinishDate')}
            </span>
            <input
              type="date"
              disabled={fieldDisabled('worksFinishDate')}
              min={value.worksStartDate || undefined}
              value={value.worksFinishDate ?? ''}
              onChange={(e) =>
                setSchedule({ worksFinishDate: e.target.value || undefined })
              }
            />
          </label>
          <label className="bid-proposal-field">
            <span className="field-label">
              {t('contractTerms.contractPeriodDays')}
            </span>
            <input
              type="text"
              readOnly
              disabled
              value={
                contractPeriodDays != null
                  ? t('contractTerms.contractPeriodDaysValue', {
                      days: contractPeriodDays,
                    })
                  : ''
              }
              placeholder={t('contractTerms.contractPeriodDaysPlaceholder')}
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

        <ContractTermsTextOptionField
          label={t('contractTerms.retentionReleaseSchedule')}
          value={value.retentionReleaseNotes ?? ''}
          onChange={(next) => set('retentionReleaseNotes', next)}
          options={retentionReleaseOptions}
          disabled={fieldDisabled('retentionReleaseNotes')}
          rows={2}
        />

        <ContractTermsTextOptionField
          label={
            <>
              {t('contractTerms.warrantyPeriodNotes')}
              <span className="field-hint muted">
                {t('contractTerms.warrantyPeriodNotesHint')}
              </span>
            </>
          }
          value={value.warrantyPeriodNotes ?? ''}
          onChange={(next) => set('warrantyPeriodNotes', next)}
          options={warrantyPeriodOptions}
          disabled={fieldDisabled('warrantyPeriodNotes')}
          rows={2}
        />

        <ContractTermsTextOptionField
          label={
            <>
              {t('contractTerms.delayDamages')}
              <span className="field-hint muted">
                {t('contractTerms.delayDamagesHint')}
              </span>
            </>
          }
          value={value.delayDamagesNotes ?? ''}
          onChange={(next) => set('delayDamagesNotes', next)}
          options={delayDamagesOptions}
          disabled={fieldDisabled('delayDamagesNotes')}
          rows={2}
        />

        <ContractTermsTextOptionField
          label={
            <>
              {t('contractTerms.specialConditions')}
              <span className="field-hint muted">
                {t('contractTerms.specialConditionsHint')}
              </span>
            </>
          }
          value={value.specialConditions ?? ''}
          onChange={(next) => set('specialConditions', next)}
          options={specialConditionsOptions}
          disabled={fieldDisabled('specialConditions')}
          rows={4}
          customPlaceholder={t('contractTerms.specialConditionsPlaceholder')}
        />

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
      </div>
    </div>
  );
}
