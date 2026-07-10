'use client';

import { useMemo } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  formatAmendmentType,
  formatBidStatus,
  formatDocumentCategory,
  formatParticipationLabel,
  formatProjectStatus,
  formatProjectType,
  formatPropertyType,
  formatTenderStatus,
  formatVerificationStatus,
  getContractSigningHeadline,
  getContractSigningMessage,
} from '@/lib/i18n/formatters';

export function useAppFormatters() {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      t,
      formatProjectStatus: (status: string) => formatProjectStatus(status, t),
      formatProjectType: (type: string) => formatProjectType(type, t),
      formatPropertyType: (type: string | null) => formatPropertyType(type, t),
      formatTenderStatus: (status: string) => formatTenderStatus(status, t),
      formatBidStatus: (status: string) => formatBidStatus(status, t),
      formatParticipationLabel: (application: Parameters<
        typeof formatParticipationLabel
      >[0]) => formatParticipationLabel(application, t),
      formatVerificationStatus: (status: string) =>
        formatVerificationStatus(status, t),
      formatAmendmentType: (type: string | null) =>
        formatAmendmentType(type, t),
      formatDocumentCategory: (category: string) =>
        formatDocumentCategory(category, t),
      getContractSigningHeadline: (status: string) =>
        getContractSigningHeadline(status, t),
      getContractSigningMessage: (status: string) =>
        getContractSigningMessage(status, t),
    }),
    [t],
  );
}
