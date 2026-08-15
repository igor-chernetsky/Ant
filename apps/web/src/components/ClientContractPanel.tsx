'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BidChat } from '@/components/BidChat';
import { ContractAddendaPanel } from '@/components/ContractAddendaPanel';
import { ContractDocumentEditor } from '@/components/ContractDocumentEditor';
import { CustomContractPreview } from '@/components/CustomContractPreview';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [focusContractEditor] = useState(
    () => searchParams.get('contract') === 'edit',
  );
  const clearedContractQueryRef = useRef(false);
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

  useEffect(() => {
    if (!focusContractEditor || clearedContractQueryRef.current) {
      return;
    }
    clearedContractQueryRef.current = true;
    router.replace(`/projects/${projectId}`, { scroll: false });
  }, [focusContractEditor, projectId, router]);

  useEffect(() => {
    if (!focusContractEditor || loading || !contract) {
      return;
    }
    const section = document.getElementById('project-contract');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusContractEditor, loading, contract]);

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
    <section id="project-contract" className="card client-contract-card">
      <div className="client-contract-header">
        <div className="client-contract-heading">
          <h2 className="section-title">{t('contractPanel.title')}</h2>
          {contract && <ContractSigningStatusPill contract={contract} />}
        </div>
        <div className="client-contract-header-actions">
          <Link
            href={`/projects/${projectId}/bids`}
            className="primary tender-summary-cta"
          >
            {t('tenderCard.reviewBids')}
          </Link>
        </div>
      </div>
      <p className="muted client-contract-hint">
        {project.status === 'active'
          ? t('contractPanel.activeHint')
          : t('contractPanel.hint')}
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
              if (onProjectUpdated) {
                void fetchProject(projectId).then(onProjectUpdated);
              }
            }}
          />

          {contract && !contract.hasCustomContract && (
            <ContractDocumentEditor
              projectId={projectId}
              contract={contract}
              initialOpen={focusContractEditor}
              onSaved={setContract}
            />
          )}
          {contract?.hasCustomContract && (
            <CustomContractPreview
              projectId={projectId}
              contract={contract}
            />
          )}

          <ContractAddendaPanel
            projectId={projectId}
            enabled={Boolean(contract?.fullySigned)}
            reusedSignatureDataUrl={contract?.clientSignatureDataUrl ?? null}
          />

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
