'use client';

import { useId, useMemo, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  localizedContractTermsOptionValue,
  matchContractTermsOptionId,
  type ContractTermsTextOption,
} from '@/lib/contract-terms-options';

export const CONTRACT_TERMS_CUSTOM_OPTION_ID = '__custom__';

interface ContractTermsTextOptionFieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  value: string;
  onChange: (next: string) => void;
  options: ContractTermsTextOption[];
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  customPlaceholder?: string;
}

export function ContractTermsTextOptionField({
  label,
  hint,
  value,
  onChange,
  options,
  disabled = false,
  multiline = true,
  rows = 2,
  customPlaceholder,
}: ContractTermsTextOptionFieldProps) {
  const { t } = useTranslation();
  const selectId = useId();
  const inputId = useId();
  const matchedOptionId = useMemo(
    () => matchContractTermsOptionId(value, options),
    [value, options],
  );
  const displayValue = useMemo(
    () => localizedContractTermsOptionValue(value, options),
    [value, options],
  );
  // Lets the user pick "Custom" while the text still matches a template,
  // so they can edit without the select snapping back.
  const [forceCustom, setForceCustom] = useState(false);

  const hasTemplates = options.length > 0;
  const selectValue =
    forceCustom || matchedOptionId === CONTRACT_TERMS_CUSTOM_OPTION_ID
      ? CONTRACT_TERMS_CUSTOM_OPTION_ID
      : matchedOptionId;

  const handleSelectChange = (nextId: string) => {
    if (nextId === '') {
      setForceCustom(false);
      onChange('');
      return;
    }

    if (nextId === CONTRACT_TERMS_CUSTOM_OPTION_ID) {
      setForceCustom(true);
      return;
    }

    const option = options.find((item) => item.id === nextId);
    if (!option) {
      return;
    }

    setForceCustom(false);
    onChange(option.value);
  };

  const handleTextChange = (next: string) => {
    if (
      matchContractTermsOptionId(next, options) ===
      CONTRACT_TERMS_CUSTOM_OPTION_ID
    ) {
      setForceCustom(false);
    }
    onChange(next);
  };

  if (disabled) {
    return (
      <div className="contract-terms-text-option contract-terms-text-option--readonly">
        <div className="contract-terms-text-option-label">
          {label}
          {hint}
        </div>
        {multiline ? (
          <textarea
            rows={rows}
            readOnly
            disabled
            aria-readonly
            value={displayValue}
            placeholder={customPlaceholder}
          />
        ) : (
          <input
            type="text"
            readOnly
            disabled
            aria-readonly
            value={displayValue}
            placeholder={customPlaceholder}
          />
        )}
      </div>
    );
  }

  return (
    <div className="contract-terms-text-option">
      <div className="contract-terms-text-option-label">
        <label htmlFor={hasTemplates ? selectId : inputId}>{label}</label>
        {hint}
      </div>

      {hasTemplates && (
        <select
          id={selectId}
          className="contract-terms-text-option-select"
          disabled={disabled}
          value={selectValue}
          onChange={(event) => handleSelectChange(event.target.value)}
        >
          <option value="">{t('contractTerms.textOptionSelect')}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
          <option value={CONTRACT_TERMS_CUSTOM_OPTION_ID}>
            {t('contractTerms.textOptionCustom')}
          </option>
        </select>
      )}

      {multiline ? (
        <textarea
          id={inputId}
          rows={rows}
          disabled={disabled}
          value={displayValue}
          placeholder={customPlaceholder}
          onChange={(event) => handleTextChange(event.target.value)}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          disabled={disabled}
          value={displayValue}
          placeholder={customPlaceholder}
          onChange={(event) => handleTextChange(event.target.value)}
        />
      )}
    </div>
  );
}
