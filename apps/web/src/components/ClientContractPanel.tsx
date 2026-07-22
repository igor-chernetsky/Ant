'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BidChat } from '@/components/BidChat';
import { ContractDocumentEditor } from '@/components/ContractDocumentEditor';
import { ContractSigningPanel } from '@/components/ContractSigningPanel';
import { ContractSigningStatusPill } from '@/components/ContractSigningStatusPill';
import { useSession } from '@/components/SessionProvider';
import { useTranslation } from '@/components/LocaleProvider';
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
  const { t } = useTranslation();
  const { me } = useSession();
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
  const awardedBid =
    awardedBidId != null
      ? (tender?.bids.find((bid) => bid.id === awardedBidId) ?? null)
      : null;
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

  const showWinnerChat =
    Boolean(me?.id && awardedBidId) &&
    (project.clarificationMode === 'open_chat' ||
      project.clarificationMode === 'structured_qa');

  return (
    <section className="card client-contract-card">
      <div className="client-contract-header">
        <h2 className="section-title">{t('contractPanel.title')}</h2>
        {contract && <ContractSigningStatusPill contract={contract} />}
      </div>
      <p className="muted client-contract-hint">
        {t('contractPanel.hint')}{' '}
        <Link href={`/projects/${projectId}/bids`} className="text-link">
          {t('contractPanel.viewApplications')}
        </Link>
      </p>

      {loading ? (
        <p className="muted">{t('contractPanel.loading')}</p>
      ) : awardedBidId ? (
        <>
          <ContractSigningPanel
            projectId={projectId}
            bidId={awardedBidId}
            hideHeading
            contract={contract}
            bidAmount={awardedBid?.amount}
            currency={tender?.currency ?? 'THB'}
            onSigned={handleSigned}
            onAwardReleased={() => {
              void loadTender();
              void loadContract();
              onProjectUpdated?.(project);
            }}
          />

          {contract && (
            <ContractDocumentEditor
              projectId={projectId}
              contract={contract}
              onSaved={setContract}
            />
          )}

          {showWinnerChat && me?.id && (
            <div className="tender-subsection client-contract-chat">
              <BidChat
                bidId={awardedBidId}
                projectId={projectId}
                currentUserId={me.id}
                title={t('bidApplication.chatWith', {
                  name: awardedBid?.companyName ?? t('common.contractor'),
                })}
              />
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
