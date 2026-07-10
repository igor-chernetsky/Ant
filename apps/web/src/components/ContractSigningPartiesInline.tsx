'use client';

import { formatDateTime } from '@/lib/projects';
import type { ProjectContract } from '@/lib/contracts';

interface ContractSigningPartiesInlineProps {
  contract: ProjectContract;
}

function partyLabel(signedAt: string | null): string {
  return signedAt ? `Signed ${formatDateTime(signedAt)}` : 'Awaiting';
}

export function ContractSigningPartiesInline({
  contract,
}: ContractSigningPartiesInlineProps) {
  return (
    <p className="contract-signing-parties-inline muted">
      <span
        className={
          contract.clientSignedAt
            ? 'contract-signing-party-inline contract-signing-party-inline--signed'
            : 'contract-signing-party-inline'
        }
      >
        Client: {partyLabel(contract.clientSignedAt)}
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
        Contractor: {partyLabel(contract.contractorSignedAt)}
      </span>
    </p>
  );
}
