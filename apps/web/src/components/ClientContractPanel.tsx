'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ContractSigningPanel } from '@/components/ContractSigningPanel';
import { ContractSigningStatusPill } from '@/components/ContractSigningStatusPill';
import { fetchProjectContract, type ProjectContract } from '@/lib/contracts';
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
  const [contract, setContract] = useState<ProjectContract | null>(null);
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

  const loadContract = useCallback(async () => {
    try {
      const data = await fetchProjectContract(projectId);
      setContract(data);
    } catch {
      setContract(null);
    }
  }, [projectId]);

  useEffect(() => {
    if (!isContractProjectStatus(project.status)) {
      setTender(null);
      setContract(null);
      setLoading(false);
      return;
    }
    void loadTender();
    void loadContract();
  }, [project.status, loadTender, loadContract]);

  const awardedBidId = tender?.awardedBidId;
  if (!loading && !awardedBidId) {
    return null;
  }

  const handleSigned = (signedContract: ProjectContract) => {
    setContract(signedContract);
    if (!signedContract.fullySigned || !onProjectUpdated) {
      return;
    }
    void fetchProject(projectId).then(onProjectUpdated);
  };

  return (
    <section className="card client-contract-card">
      <div className="client-contract-header">
        <h2 className="section-title">Contract</h2>
        {contract && <ContractSigningStatusPill contract={contract} />}
      </div>
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
          contract={contract}
          onSigned={handleSigned}
        />
      ) : null}
    </section>
  );
}
