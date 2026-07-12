'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import type { ContractTermsTextOption } from '@/lib/contract-terms-options';

export const CONTRACT_TERMS_CUSTOM_OPTION_ID = '__custom__';

function resolveOptionId(
  value: string,
  options: ContractTermsTextOption[],
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return (
    options.find((option) => option.value.trim() === trimmed)?.id ??
    CONTRACT_TERMS_CUSTOM_OPTION_ID
  );
}

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
  const matchedOptionId = useMemo(
    () => resolveOptionId(value, options),
    [value, options],
  );
  const [customSelected, setCustomSelected] = useState(false);

  useEffect(() => {
    if (
      matchedOptionId !== CONTRACT_TERMS_CUSTOM_OPTION_ID &&
      matchedOptionId !== ''
    ) {
      setCustomSelected(false);
    }
  }, [matchedOptionId]);

  const selectValue = customSelected
    ? CONTRACT_TERMS_CUSTOM_OPTION_ID
    : matchedOptionId;

  const showCustomInput =
    customSelected || matchedOptionId === CONTRACT_TERMS_CUSTOM_OPTION_ID;

  const handleSelectChange = (nextId: string) => {
    if (nextId === '') {
      setCustomSelected(false);
      onChange('');
      return;
    }

    if (nextId === CONTRACT_TERMS_CUSTOM_OPTION_ID) {
      setCustomSelected(true);
      return;
    }

    const option = options.find((item) => item.id === nextId);
    if (!option) {
      return;
    }

    setCustomSelected(false);
    onChange(option.value);
  };

  const hasTemplates = options.length > 0;

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
            value={value}
            placeholder={customPlaceholder}
          />
        ) : (
          <input
            type="text"
            readOnly
            disabled
            aria-readonly
            value={value}
            placeholder={customPlaceholder}
          />
        )}
      </div>
    );
  }

  return (
    <div className="contract-terms-text-option">
      <label htmlFor={selectId}>
        {label}
        {hint}
      </label>

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

      {(!hasTemplates || showCustomInput) && (
        multiline ? (
          <textarea
            rows={rows}
            disabled={disabled}
            value={value}
            placeholder={customPlaceholder}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            type="text"
            disabled={disabled}
            value={value}
            placeholder={customPlaceholder}
            onChange={(event) => onChange(event.target.value)}
          />
        )
      )}
    </div>
  );
}
