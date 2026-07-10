'use client';

import { formatDateTime } from '@/lib/projects';
import type { ProjectContract } from '@/lib/contracts';
import {
  getContractSigningHeadline,
  getContractSigningMessage,
  getContractSigningVisualStatus,
} from '@/lib/contract-signing-status';

interface ContractSigningStatusSummaryProps {
  contract: ProjectContract;
  compact?: boolean;
}

function PartyStatus({
  label,
  signedAt,
}: {
  label: string;
  signedAt: string | null;
}) {
  const signed = Boolean(signedAt);

  return (
    <div
      className={`contract-signing-party${signed ? ' contract-signing-party--signed' : ' contract-signing-party--pending'}`}
    >
      <span className="contract-signing-party-label">{label}</span>
      <span className="contract-signing-party-state">
        {signed ? `Signed ${formatDateTime(signedAt!)}` : 'Awaiting signature'}
      </span>
    </div>
  );
}

export function ContractSigningStatusSummary({
  contract,
  compact = false,
}: ContractSigningStatusSummaryProps) {
  const status = getContractSigningVisualStatus(contract);
  const headline = getContractSigningHeadline(status);
  const message = getContractSigningMessage(contract, status);

  return (
    <div
      className={`contract-signing-status contract-signing-status--${status}${compact ? ' contract-signing-status--compact' : ''}`}
    >
      <div className="contract-signing-status-copy">
        <p className="contract-signing-status-title">{headline}</p>
        {!compact && <p className="contract-signing-status-message">{message}</p>}
      </div>

      <div className="contract-signing-status-parties">
        <PartyStatus label="Client" signedAt={contract.clientSignedAt} />
        <PartyStatus label="Contractor" signedAt={contract.contractorSignedAt} />
      </div>
    </div>
  );
}
