import type { TranslateFn } from '@/lib/i18n/formatters';

export interface ContractTermsTextOption {
  id: string;
  label: string;
  value: string;
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
    },
  ];

  if (projectTitle?.trim()) {
    options.push({
      id: 'forProject',
      label: t('contractTerms.subjectOptions.forProjectLabel', {
        title: projectTitle.trim(),
      }),
      value: t('contractTerms.subjectOptions.forProjectValue', {
        title: projectTitle.trim(),
      }),
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
    },
    {
      id: 'leasehold',
      label: t('contractTerms.propertyOwnershipOptions.leaseholdLabel'),
      value: t('contractTerms.propertyOwnershipOptions.leaseholdValue'),
    },
    {
      id: 'developerConsent',
      label: t('contractTerms.propertyOwnershipOptions.developerConsentLabel'),
      value: t('contractTerms.propertyOwnershipOptions.developerConsentValue'),
    },
  ];
}

export function buildRetentionReleaseOptions(
  t: TranslateFn,
): ContractTermsTextOption[] {
  return [
    {
      id: 'standard5050',
      label: t('contractTerms.retentionReleaseOptions.standard5050Label'),
      value: t('contractTerms.retentionReleaseOptions.standard5050Value'),
    },
    {
      id: 'singleRelease',
      label: t('contractTerms.retentionReleaseOptions.singleReleaseLabel'),
      value: t('contractTerms.retentionReleaseOptions.singleReleaseValue'),
    },
    {
      id: 'onCompletion',
      label: t('contractTerms.retentionReleaseOptions.onCompletionLabel'),
      value: t('contractTerms.retentionReleaseOptions.onCompletionValue'),
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
    },
    {
      id: 'notApplicable',
      label: t('contractTerms.delayDamagesOptions.notApplicableLabel'),
      value: t('contractTerms.delayDamagesOptions.notApplicableValue'),
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
    },
    {
      id: 'exclusions',
      label: t('contractTerms.specialConditionsOptions.exclusionsLabel'),
      value: t('contractTerms.specialConditionsOptions.exclusionsValue'),
    },
    {
      id: 'clientSupplied',
      label: t('contractTerms.specialConditionsOptions.clientSuppliedLabel'),
      value: t('contractTerms.specialConditionsOptions.clientSuppliedValue'),
    },
  ];
}
