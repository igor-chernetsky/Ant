'use client';

import { formatDateTime } from '@/lib/projects';
import type { ProjectContract } from '@/lib/contracts';
import { useTranslation } from '@/components/LocaleProvider';

interface ContractSigningPartiesInlineProps {
  contract: ProjectContract;
}

export function ContractSigningPartiesInline({
  contract,
}: ContractSigningPartiesInlineProps) {
  const { t } = useTranslation();

  const partyLabel = (signedAt: string | null): string =>
    signedAt
      ? t('contractPanel.signedAt', { date: formatDateTime(signedAt) })
      : t('contractPanel.awaiting');

  return (
    <p className="contract-signing-parties-inline muted">
      <span
        className={
          contract.clientSignedAt
            ? 'contract-signing-party-inline contract-signing-party-inline--signed'
            : 'contract-signing-party-inline'
        }
      >
        {t('contractPanel.partyClient')}: {partyLabel(contract.clientSignedAt)}
      </span>
      <span className="contract-signing-parties-inline-sep" aria-hidden>
        ·
      </span>
      <span
        className={
          contract.contractorSignedAt
            ? 'contract-signing-party-inline contract-signing-party-inline--signed'
            : 'contract-signing-party-inline'
        }
      >
        {t('contractPanel.partyContractor')}:{' '}
        {partyLabel(contract.contractorSignedAt)}
      </span>
    </p>
  );
}
