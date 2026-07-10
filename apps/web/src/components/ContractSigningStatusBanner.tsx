'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchProjectContract, type ProjectContract } from '@/lib/contracts';
import { ContractSigningStatusSummary } from '@/components/ContractSigningStatusSummary';

interface ContractSigningStatusBannerProps {
  projectId: string;
  asContractor?: boolean;
  enabled?: boolean;
  refreshKey?: number;
}

export function ContractSigningStatusBanner({
  projectId,
  asContractor = false,
  enabled = true,
  refreshKey = 0,
}: ContractSigningStatusBannerProps) {
  const [contract, setContract] = useState<ProjectContract | null>(null);
  const [loading, setLoading] = useState(false);

  const loadContract = useCallback(async () => {
    if (!enabled) {
      setContract(null);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchProjectContract(projectId, { asContractor });
      setContract(data);
    } catch {
      setContract(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, projectId, asContractor]);

  useEffect(() => {
    void loadContract();
  }, [loadContract, refreshKey]);

  if (!enabled || loading || !contract) {
    return null;
  }

  return (
    <section className="card contract-signing-status-banner" aria-live="polite">
      <ContractSigningStatusSummary contract={contract} />
    </section>
  );
}
