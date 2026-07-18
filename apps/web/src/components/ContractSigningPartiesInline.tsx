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
    <ul className="contract-signing-parties" aria-label={t('contractPanel.signingTitle')}>
      <li
        className={
          contract.clientSignedAt
            ? 'contract-signing-party contract-signing-party--signed'
            : 'contract-signing-party'
        }
      >
        <span className="contract-signing-party-role">
          {t('contractPanel.partyClient')}
        </span>
        <span className="contract-signing-party-status">
          {partyLabel(contract.clientSignedAt)}
        </span>
      </li>
      <li
        className={
          contract.contractorSignedAt
            ? 'contract-signing-party contract-signing-party--signed'
            : 'contract-signing-party'
        }
      >
        <span className="contract-signing-party-role">
          {t('contractPanel.partyContractor')}
        </span>
        <span className="contract-signing-party-status">
          {partyLabel(contract.contractorSignedAt)}
        </span>
      </li>
    </ul>
  );
}
