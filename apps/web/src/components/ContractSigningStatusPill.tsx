'use client';

import type { ProjectContract } from '@/lib/contracts';
import {
  getContractSigningHeadline,
  getContractSigningVisualStatus,
} from '@/lib/contract-signing-status';

interface ContractSigningStatusPillProps {
  contract: ProjectContract;
}

export function ContractSigningStatusPill({ contract }: ContractSigningStatusPillProps) {
  const status = getContractSigningVisualStatus(contract);

  return (
    <span
      className={`status-pill contract-signing-status-pill contract-signing-status-pill--${status}`}
    >
      {getContractSigningHeadline(status)}
    </span>
  );
}
