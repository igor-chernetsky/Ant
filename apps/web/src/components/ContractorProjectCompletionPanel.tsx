'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  confirmContractorProjectCompletion,
  fetchContractorProjectCompletionContext,
  requestContractorProjectCompletion,
  type ProjectCompletionContext,
} from '@/lib/project-reviews';

interface ContractorProjectCompletionPanelProps {
  projectId: string;
  projectStatus: string;
  contractFullySigned: boolean;
  onUpdated?: () => void;
}

export function ContractorProjectCompletionPanel({
  projectId,
  projectStatus,
  contractFullySigned,
  onUpdated,
}: ContractorProjectCompletionPanelProps) {
  const { t } = useTranslation();
  const [completion, setCompletion] = useState<ProjectCompletionContext | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompletion = useCallback(async () => {
    if (projectStatus !== 'active') {
      setCompletion(null);
      return;
    }
    setLoading(true);
    try {
      const context = await fetchContractorProjectCompletionContext(projectId);
      setCompletion(context);
    } catch {
      setCompletion(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, projectStatus]);

  useEffect(() => {
    void loadCompletion();
  }, [loadCompletion]);

  if (!contractFullySigned || projectStatus !== 'active') {
    return null;
  }

  const canRequest = completion?.canRequestCompletion ?? false;
  const canConfirm = completion?.canConfirmCompletion ?? false;
  const waitingForOtherParty =
    completion?.completionRequestedBy === 'contractor';
  const clientRequested =
    completion?.completionRequestedBy === 'client';

  if (!loading && !canRequest && !canConfirm && !waitingForOtherParty) {
    return null;
  }

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await loadCompletion();
      onUpdated?.();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('lifecycle.actionFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tender-subsection contractor-completion-panel">
      <h3 className="tender-subsection-title">
        {t('lifecycle.contractorCompletionTitle')}
      </h3>
      {loading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : waitingForOtherParty ? (
        <p className="muted">{t('lifecycle.contractorWaitingClientHint')}</p>
      ) : clientRequested && canConfirm ? (
        <p className="muted">{t('lifecycle.contractorConfirmClientHint')}</p>
      ) : canRequest ? (
        <p className="muted">{t('lifecycle.contractorRequestHint')}</p>
      ) : null}

      <div className="project-lifecycle-actions">
        {canRequest && (
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() =>
              void runAction(async () => {
                await requestContractorProjectCompletion(projectId);
              })
            }
          >
            {busy
              ? t('lifecycle.requestingCompletion')
              : t('lifecycle.requestCompletion')}
          </button>
        )}
        {canConfirm && (
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() =>
              void runAction(async () => {
                await confirmContractorProjectCompletion(projectId);
              })
            }
          >
            {busy
              ? t('lifecycle.confirmingCompletion')
              : t('lifecycle.confirmCompletion')}
          </button>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
