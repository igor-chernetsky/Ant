export type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

function tOrFallback(
  t: TranslateFn | undefined,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
): string {
  if (!t) return fallback;
  const value = t(key, params);
  return value === key ? fallback : value;
}

export function formatProjectStatus(status: string, t?: TranslateFn): string {
  return tOrFallback(t, `projectStatus.${status}`, status.replaceAll('_', ' '));
}

export function formatProjectType(type: string, t?: TranslateFn): string {
  return tOrFallback(t, `projectType.${type}`, type.replaceAll('_', ' '));
}

export function formatPropertyType(type: string | null, t?: TranslateFn): string {
  if (!type) return t?.('common.dash') ?? '—';
  return formatProjectType(type, t);
}

export function formatTenderStatus(status: string, t?: TranslateFn): string {
  return tOrFallback(t, `tenderStatus.${status}`, status.replaceAll('_', ' '));
}

export function formatBidStatus(status: string, t?: TranslateFn): string {
  return tOrFallback(t, `bidStatus.${status}`, status.replaceAll('_', ' '));
}

export function formatParticipationLabel(
  application: {
    projectStatus: string;
    bidStatus: string;
    isActiveProject?: boolean;
    contenderNumber?: number | null;
  },
  t?: TranslateFn,
): string {
  if (!t) {
    return formatParticipationLabelEn(application);
  }
  if (application.projectStatus === 'completed') {
    return application.bidStatus === 'selected'
      ? t('participation.completedProject')
      : t('participation.projectCompleted');
  }
  if (application.isActiveProject || application.bidStatus === 'selected') {
    return t('participation.activeProject');
  }
  if (application.bidStatus === 'clarifying') {
    return t('participation.clarifyingScope');
  }
  if (application.bidStatus === 'enrolled') {
    return application.contenderNumber != null
      ? t('participation.contender', { n: application.contenderNumber })
      : t('participation.enrolled');
  }
  if (application.bidStatus === 'submitted') {
    return t('participation.proposalSubmitted');
  }
  if (application.bidStatus === 'rejected') {
    return t('participation.notSelected');
  }
  return formatBidStatus(application.bidStatus, t);
}

function formatParticipationLabelEn(application: {
  projectStatus: string;
  bidStatus: string;
  isActiveProject?: boolean;
  contenderNumber?: number | null;
}): string {
  if (application.projectStatus === 'completed') {
    return application.bidStatus === 'selected'
      ? 'Completed project'
      : 'Project completed';
  }
  if (application.isActiveProject || application.bidStatus === 'selected') {
    return 'Active project';
  }
  if (application.bidStatus === 'clarifying') {
    return 'Clarifying scope';
  }
  if (application.bidStatus === 'enrolled') {
    return application.contenderNumber != null
      ? `Contender #${application.contenderNumber}`
      : 'Enrolled';
  }
  if (application.bidStatus === 'submitted') {
    return 'Proposal submitted';
  }
  if (application.bidStatus === 'rejected') {
    return 'Not selected';
  }
  return application.bidStatus.replaceAll('_', ' ');
}

export function formatVerificationStatus(status: string, t?: TranslateFn): string {
  return tOrFallback(t, `verificationStatus.${status}`, status.replaceAll('_', ' '));
}

export function formatAmendmentType(type: string | null, t?: TranslateFn): string {
  if (!type) return t?.('common.dash') ?? '—';
  return tOrFallback(t, `amendmentType.${type}`, type.replaceAll('_', ' '));
}

export function formatDocumentCategory(category: string, t?: TranslateFn): string {
  return tOrFallback(t, `documentCategory.${category}`, category.replaceAll('_', ' '));
}

export function getContractSigningHeadline(
  status: string,
  t?: TranslateFn,
): string {
  const key = `contractSigning.headline.${status}`;
  const fallbacks: Record<string, string> = {
    fully_signed: 'Contract fully signed',
    awaiting_client: 'Waiting for client signature',
    awaiting_contractor: 'Waiting for contractor signature',
    awaiting_both: 'Contract awaiting signatures',
  };
  return tOrFallback(t, key, fallbacks[status] ?? 'Contract awaiting signatures');
}

export function getContractSigningMessage(
  status: string,
  t?: TranslateFn,
): string {
  const key = `contractSigning.message.${status}`;
  const fallbacks: Record<string, string> = {
    fully_signed: 'Both parties have signed. The project is now active.',
    awaiting_client:
      'The contractor has signed. The client still needs to sign the contract draft.',
    awaiting_contractor:
      'The client has signed. The selected contractor still needs to sign the contract draft.',
    awaiting_both:
      'The client and selected contractor both need to sign the contract draft before work can start.',
  };
  return tOrFallback(t, key, fallbacks[status] ?? fallbacks.awaiting_both);
}
