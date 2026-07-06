'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ContractSigningPanel } from '@/components/ContractSigningPanel';
import type { ProjectContract } from '@/lib/contracts';
import { fetchProject, type Project } from '@/lib/projects';
import { fetchProjectTender, type Tender } from '@/lib/tendering';

interface ClientContractPanelProps {
  projectId: string;
  project: Project;
  onProjectUpdated?: (project: Project) => void;
}

export function isContractProjectStatus(status: string): boolean {
  return status === 'awarded' || status === 'active';
}

export function ClientContractPanel({
  projectId,
  project,
  onProjectUpdated,
}: ClientContractPanelProps) {
  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTender = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProjectTender(projectId);
      setTender(data);
    } catch {
      setTender(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!isContractProjectStatus(project.status)) {
      setTender(null);
      setLoading(false);
      return;
    }
    void loadTender();
  }, [project.status, loadTender]);

  const awardedBidId = tender?.awardedBidId;
  if (!loading && !awardedBidId) {
    return null;
  }

  const handleSigned = (contract: ProjectContract) => {
    if (!contract.fullySigned || !onProjectUpdated) {
      return;
    }
    void fetchProject(projectId).then(onProjectUpdated);
  };

  return (
    <section className="card client-contract-card">
      <h2 className="section-title">Contract</h2>
      <p className="muted client-contract-hint">
        Review the contract draft and sign to activate the project.{' '}
        <Link href={`/projects/${projectId}/bids`} className="text-link">
          View applications
        </Link>
      </p>

      {loading ? (
        <p className="muted">Loading contract…</p>
      ) : awardedBidId ? (
        <ContractSigningPanel
          projectId={projectId}
          bidId={awardedBidId}
          hideHeading
          onSigned={handleSigned}
        />
      ) : null}
    </section>
  );
}
