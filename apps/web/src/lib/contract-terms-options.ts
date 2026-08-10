import { messages, type Messages } from '@/lib/i18n/messages';
import { SUPPORTED_LOCALES } from '@/lib/i18n';
import type { TranslateFn } from '@/lib/i18n/formatters';
import {
  DEFAULT_PROPERTY_OWNERSHIP,
  DEFAULT_RETENTION_RELEASE_NOTES,
} from '@/lib/contract-terms-fields';

export interface ContractTermsTextOption {
  id: string;
  label: string;
  /** Value written when this template is selected (current UI locale). */
  value: string;
  /** Known stored values across locales — used to recognize an existing selection. */
  aliases: string[];
}

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] != null ? String(vars[key]) : `{${key}}`,
  );
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function optionValuesAcrossLocales(
  pick: (contractTerms: Messages['contractTerms']) => string,
  vars?: Record<string, string | number>,
  extras: string[] = [],
): string[] {
  return uniqueNonEmpty([
    ...SUPPORTED_LOCALES.map((locale) =>
      interpolate(pick(messages[locale].contractTerms), vars),
    ),
    ...extras,
  ]);
}

export function matchContractTermsOptionId(
  value: string,
  options: ContractTermsTextOption[],
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const matched = options.find((option) => {
    if (option.value.trim() === trimmed) {
      return true;
    }
    return option.aliases.some((alias) => alias === trimmed);
  });

  return matched?.id ?? '__custom__';
}

export function localizedContractTermsOptionValue(
  value: string,
  options: ContractTermsTextOption[],
): string {
  const optionId = matchContractTermsOptionId(value, options);
  if (!optionId || optionId === '__custom__') {
    return value;
  }
  return options.find((option) => option.id === optionId)?.value ?? value;
}

export function buildSubjectOfContractOptions(
  t: TranslateFn,
  projectTitle?: string,
): ContractTermsTextOption[] {
  const options: ContractTermsTextOption[] = [
    {
      id: 'asPerDrawings',
      label: t('contractTerms.subjectOptions.asPerDrawingsLabel'),
      value: t('contractTerms.subjectOptions.asPerDrawingsValue'),
      aliases: optionValuesAcrossLocales(
        (ct) => ct.subjectOptions.asPerDrawingsValue,
      ),
    },
  ];

  const title = projectTitle?.trim();
  if (title) {
    options.push({
      id: 'forProject',
      label: t('contractTerms.subjectOptions.forProjectLabel', { title }),
      value: t('contractTerms.subjectOptions.forProjectValue', { title }),
      aliases: optionValuesAcrossLocales(
        (ct) => ct.subjectOptions.forProjectValue,
        { title },
      ),
    });
  }

  return options;
}

export function buildSiteAddressOptions(
  t: TranslateFn,
  district?: string | null,
): ContractTermsTextOption[] {
  const trimmed = district?.trim();
  if (!trimmed) {
    return [];
  }

  return [
    {
      id: 'projectDistrict',
      label: t('contractTerms.siteAddressOptions.districtLabel', {
        district: trimmed,
      }),
      value: trimmed,
      aliases: [trimmed],
    },
  ];
}

export function buildPropertyOwnershipOptions(
  t: TranslateFn,
): ContractTermsTextOption[] {
  return [
    {
      id: 'employerTitle',
      label: t('contractTerms.propertyOwnershipOptions.employerTitleLabel'),
      value: t('contractTerms.propertyOwnershipOptions.employerTitleValue'),
      aliases: optionValuesAcrossLocales(
        (ct) => ct.propertyOwnershipOptions.employerTitleValue,
        undefined,
        [DEFAULT_PROPERTY_OWNERSHIP],
      ),
    },
    {
      id: 'leasehold',
      label: t('contractTerms.propertyOwnershipOptions.leaseholdLabel'),
      value: t('contractTerms.propertyOwnershipOptions.leaseholdValue'),
      aliases: optionValuesAcrossLocales(
        (ct) => ct.propertyOwnershipOptions.leaseholdValue,
      ),
    },
    {
      id: 'developerConsent',
      label: t('contractTerms.propertyOwnershipOptions.developerConsentLabel'),
      value: t('contractTerms.propertyOwnershipOptions.developerConsentValue'),
      aliases: optionValuesAcrossLocales(
        (ct) => ct.propertyOwnershipOptions.developerConsentValue,
      ),
    },
  ];
}

type RetentionReleaseOptionKey =
  | 'standard5050Label'
  | 'standard5050Value'
  | 'singleReleaseLabel'
  | 'singleReleaseValue'
  | 'onCompletionLabel'
  | 'onCompletionValue';

const LEGACY_CONSTRUCTION_RETENTION_ALIASES: Record<
  'standard5050' | 'singleRelease' | 'onCompletion',
  string[]
> = {
  standard5050: [
    '5% on Taking-Over Certificate; 5% after 12 months from Practical Completion.',
    '5% по акту приёмки; 5% через 12 месяцев после практической сдачи.',
    '5% เมื่อออกใบรับมอบงาน; 5% หลัง 12 เดือนนับจากวันส่งมอบใช้งานจริง',
  ],
  singleRelease: [
    'Full retention released 12 months after Practical Completion, subject to defect rectification.',
    'Полное удержание возвращается через 12 месяцев после практической сдачи при условии устранения дефектов.',
    'คืนเงินประกันทั้งหมดภายใน 12 เดือนหลังส่งมอบใช้งานจริง โดยมีเงื่อนไขการแก้ไขข้อบกพร่อง',
  ],
  onCompletion: [
    'Retention released upon Practical Completion, subject to final account and defect rectification.',
    'Удержание возвращается при практической сдаче с учётом окончательного расчёта и устранения дефектов.',
    'คืนเงินประกันเมื่อส่งมอบใช้งานจริง โดยมีเงื่อนไขการชำระบัญชีสุดท้ายและแก้ไขข้อบกพร่อง',
  ],
};

function pickRetentionReleaseOptions(isDesign: boolean) {
  return (contractTerms: Messages['contractTerms']) =>
    isDesign
      ? contractTerms.designRetentionReleaseOptions
      : contractTerms.retentionReleaseOptions;
}

function pickRetentionReleaseKey(
  isDesign: boolean,
  key: RetentionReleaseOptionKey,
) {
  return (contractTerms: Messages['contractTerms']) =>
    pickRetentionReleaseOptions(isDesign)(contractTerms)[key];
}

export function buildRetentionReleaseOptions(
  t: TranslateFn,
  isDesign = false,
): ContractTermsTextOption[] {
  const prefix = isDesign ? 'designRetentionReleaseOptions' : 'retentionReleaseOptions';
  return [
    {
      id: 'standard5050',
      label: t(`contractTerms.${prefix}.standard5050Label`),
      value: t(`contractTerms.${prefix}.standard5050Value`),
      aliases: optionValuesAcrossLocales(
        pickRetentionReleaseKey(isDesign, 'standard5050Value'),
        undefined,
        isDesign
          ? []
          : [
              ...LEGACY_CONSTRUCTION_RETENTION_ALIASES.standard5050,
              DEFAULT_RETENTION_RELEASE_NOTES,
            ],
      ),
    },
    {
      id: 'singleRelease',
      label: t(`contractTerms.${prefix}.singleReleaseLabel`),
      value: t(`contractTerms.${prefix}.singleReleaseValue`),
      aliases: optionValuesAcrossLocales(
        pickRetentionReleaseKey(isDesign, 'singleReleaseValue'),
        undefined,
        isDesign ? [] : LEGACY_CONSTRUCTION_RETENTION_ALIASES.singleRelease,
      ),
    },
    {
      id: 'onCompletion',
      label: t(`contractTerms.${prefix}.onCompletionLabel`),
      value: t(`contractTerms.${prefix}.onCompletionValue`),
      aliases: optionValuesAcrossLocales(
        pickRetentionReleaseKey(isDesign, 'onCompletionValue'),
        undefined,
        isDesign ? [] : LEGACY_CONSTRUCTION_RETENTION_ALIASES.onCompletion,
      ),
    },
  ];
}

export function buildWarrantyPeriodOptions(
  t: TranslateFn,
  months: number,
): ContractTermsTextOption[] {
  return [
    {
      id: 'defectNotification',
      label: t('contractTerms.warrantyPeriodOptions.defectNotificationLabel', {
        months,
      }),
      value: t('contractTerms.warrantyPeriodOptions.defectNotificationValue', {
        months,
      }),
      aliases: optionValuesAcrossLocales(
        (ct) => ct.warrantyPeriodOptions.defectNotificationValue,
        { months },
      ),
    },
  ];
}

export function buildDelayDamagesOptions(
  t: TranslateFn,
): ContractTermsTextOption[] {
  return [
    {
      id: 'standardRate',
      label: t('contractTerms.delayDamagesOptions.standardRateLabel'),
      value: t('contractTerms.delayDamagesOptions.standardRateValue'),
      aliases: optionValuesAcrossLocales(
        (ct) => ct.delayDamagesOptions.standardRateValue,
      ),
    },
    {
      id: 'notApplicable',
      label: t('contractTerms.delayDamagesOptions.notApplicableLabel'),
      value: t('contractTerms.delayDamagesOptions.notApplicableValue'),
      aliases: optionValuesAcrossLocales(
        (ct) => ct.delayDamagesOptions.notApplicableValue,
      ),
    },
  ];
}

export function buildSpecialConditionsOptions(
  t: TranslateFn,
): ContractTermsTextOption[] {
  return [
    {
      id: 'none',
      label: t('contractTerms.specialConditionsOptions.noneLabel'),
      value: t('contractTerms.specialConditionsOptions.noneValue'),
      aliases: optionValuesAcrossLocales(
        (ct) => ct.specialConditionsOptions.noneValue,
      ),
    },
    {
      id: 'exclusions',
      label: t('contractTerms.specialConditionsOptions.exclusionsLabel'),
      value: t('contractTerms.specialConditionsOptions.exclusionsValue'),
      aliases: optionValuesAcrossLocales(
        (ct) => ct.specialConditionsOptions.exclusionsValue,
      ),
    },
    {
      id: 'clientSupplied',
      label: t('contractTerms.specialConditionsOptions.clientSuppliedLabel'),
      value: t('contractTerms.specialConditionsOptions.clientSuppliedValue'),
      aliases: optionValuesAcrossLocales(
        (ct) => ct.specialConditionsOptions.clientSuppliedValue,
      ),
    },
  ];
}
