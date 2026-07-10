'use client';

import type { ProjectContract } from '@/lib/contracts';
import { getContractSigningVisualStatus } from '@/lib/contract-signing-status';
import { useAppFormatters } from '@/hooks/useAppFormatters';

interface ContractSigningStatusPillProps {
  contract: ProjectContract;
}

export function ContractSigningStatusPill({ contract }: ContractSigningStatusPillProps) {
  const { getContractSigningHeadline } = useAppFormatters();
  const status = getContractSigningVisualStatus(contract);

  return (
    <span
      className={`status-pill contract-signing-status-pill contract-signing-status-pill--${status}`}
    >
      {getContractSigningHeadline(status)}
    </span>
  );
}
