'use client';

import { useTranslation } from '@/components/LocaleProvider';
import type { BidContractTerms } from '@/lib/tendering';
import { missingEmployerLegalFields } from '@/lib/contract-terms-fields';

interface EmployerLegalFieldsProps {
  value: BidContractTerms;
  onChange: (next: BidContractTerms) => void;
  disabled?: boolean;
  /** Ids are shared with the contract-terms fields so focus on error still works. */
  idPrefix?: string;
}

/**
 * The employer's legal details, on their own publishing step.
 *
 * These three fields are required to publish but used to sit at the very bottom of an
 * expanded 20-field contract-terms block, so the "Next" button looked broken.
 */
export function EmployerLegalFields({
  value,
  onChange,
  disabled = false,
  idPrefix = 'bid-terms',
}: EmployerLegalFieldsProps) {
  const { t } = useTranslation();
  const missing = missingEmployerLegalFields(value);
  const set = (key: keyof BidContractTerms, next: string) =>
    onChange({ ...value, [key]: next.trim() === '' ? undefined : next });

  const fieldProps = (key: 'employerName' | 'employerAddress') => ({
    'data-invalid': missing.includes(key) ? 'true' : undefined,
    'aria-invalid': missing.includes(key) ? true : undefined,
  });

  return (
    <div className="publish-employer-fields">
      <p className="muted publish-employer-hint">
        {t('tenderCard.yourDetailsHint')}
      </p>
      <label>
        {t('contractTerms.employerLegalName')}
        <input
          id={`${idPrefix}-employer-name`}
          type="text"
          required
          disabled={disabled}
          value={value.employerName ?? ''}
          onChange={(e) => set('employerName', e.target.value)}
          {...fieldProps('employerName')}
        />
      </label>
      <label>
        {t('contractTerms.employerAddress')}
        <input
          id={`${idPrefix}-employer-address`}
          type="text"
          required
          disabled={disabled}
          value={value.employerAddress ?? ''}
          onChange={(e) => set('employerAddress', e.target.value)}
          {...fieldProps('employerAddress')}
        />
      </label>
      <label>
        {t('contractTerms.employerRegistrationNo')}
        <span className="field-optional">{t('createProject.optional')}</span>
        <input
          id={`${idPrefix}-employer-registration`}
          type="text"
          disabled={disabled}
          value={value.employerRegistrationNo ?? ''}
          onChange={(e) => set('employerRegistrationNo', e.target.value)}
        />
      </label>
    </div>
  );
}
