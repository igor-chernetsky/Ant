'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { formatThb } from '@/lib/estimate';
import { computeBidCostAdjustments } from '@/lib/bid-cost-adjustments';
import {
  approveProgressClaim,
  createProgressClaimDraft,
  fetchProjectProgress,
  rejectProgressClaim,
  submitProgressClaim,
  updateProgressClaimDraft,
  type ProgressClaim,
  type ProgressOverview,
} from '@/lib/progress';

interface ProgressClaimsPanelProps {
  projectId: string;
  projectStatus: string;
}

function roundMoney(value: number): number {
  return Math.round(value);
}

export function ProgressClaimsPanel({
  projectId,
  projectStatus,
}: ProgressClaimsPanelProps) {
  const { t } = useTranslation();
  const { formatTagLabel } = useAppFormatters();
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [percentDraft, setPercentDraft] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjectProgress(projectId);
      setOverview(data);
      const claim = data.openClaim?.status === 'draft' ? data.openClaim : null;
      if (claim) {
        const next: Record<string, string> = {};
        for (const line of claim.lines) {
          next[line.trade] = String(line.percentComplete);
        }
        setPercentDraft(next);
        setNoteDraft(claim.note ?? '');
      } else {
        setPercentDraft({});
        setNoteDraft('');
      }
    } catch (err: unknown) {
      setOverview(null);
      setError(
        err instanceof Error ? err.message : t('progressSection.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    if (projectStatus !== 'active') return;
    void reload();
  }, [projectStatus, reload]);

  const openClaim = overview?.openClaim ?? null;
  const isDraft = openClaim?.status === 'draft';
  const isSubmitted = openClaim?.status === 'submitted';
  const isContractor = overview?.role === 'contractor';
  const isClient = overview?.role === 'client';

  const preview = useMemo(() => {
    if (!overview || !isDraft) return null;
    const lines = overview.baselineLines.map((base) => {
      const raw = percentDraft[base.trade];
      const percent = Number(raw);
      const safePercent = Number.isFinite(percent)
        ? Math.min(100, Math.max(base.approvedPercent, percent))
        : base.approvedPercent;
      const amountCumulative = roundMoney(
        (base.contractAmount * safePercent) / 100,
      );
      const amountPeriod = Math.max(0, amountCumulative - base.approvedAmount);
      return {
        trade: base.trade,
        description: base.description,
        contractAmount: base.contractAmount,
        percentComplete: safePercent,
        amountPreviouslyApproved: base.approvedAmount,
        amountCumulative,
        amountPeriod,
      };
    });
    const worksCumulative = lines.reduce((s, l) => s + l.amountCumulative, 0);
    const worksPeriod = lines.reduce((s, l) => s + l.amountPeriod, 0);
    const cum = computeBidCostAdjustments({
      worksSubtotal: worksCumulative,
      preliminaryPercent: overview.preliminaryPercent,
      overheadProfitPercent: overview.overheadProfitPercent,
      vatPercent: overview.vatPercent,
    });
    const period = computeBidCostAdjustments({
      worksSubtotal: worksPeriod,
      preliminaryPercent: overview.preliminaryPercent,
      overheadProfitPercent: overview.overheadProfitPercent,
      vatPercent: overview.vatPercent,
    });
    const grandPeriod = Math.max(
      0,
      cum.grandTotal - overview.approvedGrandCumulative,
    );
    return {
      lines,
      worksPeriod,
      preliminaryPeriod: period.preliminaryAmount,
      overheadProfitPeriod: period.overheadProfitAmount,
      vatPeriod: period.vatAmount,
      grandPeriod,
      grandCumulative: cum.grandTotal,
    };
  }, [overview, isDraft, percentDraft]);

  if (projectStatus !== 'active') {
    return null;
  }

  const handleCreateDraft = async () => {
    setBusy(true);
    setError(null);
    try {
      const claim = await createProgressClaimDraft(projectId);
      await reload();
      const next: Record<string, string> = {};
      for (const line of claim.lines) {
        next[line.trade] = String(line.percentComplete);
      }
      setPercentDraft(next);
      setNoteDraft(claim.note ?? '');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('progressSection.saveFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!openClaim || !overview) return;
    setBusy(true);
    setError(null);
    try {
      await updateProgressClaimDraft(projectId, openClaim.id, {
        note: noteDraft,
        lines: overview.baselineLines.map((base) => ({
          trade: base.trade,
          description: base.description,
          percentComplete: Number(percentDraft[base.trade] ?? base.approvedPercent),
        })),
      });
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('progressSection.saveFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!openClaim || !overview) return;
    setBusy(true);
    setError(null);
    try {
      await updateProgressClaimDraft(projectId, openClaim.id, {
        note: noteDraft,
        lines: overview.baselineLines.map((base) => ({
          trade: base.trade,
          description: base.description,
          percentComplete: Number(
            percentDraft[base.trade] ?? base.approvedPercent,
          ),
        })),
      });
      await submitProgressClaim(projectId, openClaim.id);
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('progressSection.submitFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (claim: ProgressClaim) => {
    setBusy(true);
    setError(null);
    try {
      await approveProgressClaim(projectId, claim.id);
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('progressSection.approveFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (claim: ProgressClaim) => {
    setBusy(true);
    setError(null);
    try {
      await rejectProgressClaim(projectId, claim.id, rejectReason);
      setRejectReason('');
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('progressSection.rejectFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return t('progressSection.statusDraft');
      case 'submitted':
        return t('progressSection.statusSubmitted');
      case 'approved':
        return t('progressSection.statusApproved');
      case 'rejected':
        return t('progressSection.statusRejected');
      default:
        return status;
    }
  };

  const displayLines =
    isDraft && preview
      ? preview.lines
      : openClaim?.lines ?? overview?.baselineLines.map((line) => ({
          trade: line.trade,
          description: line.description,
          contractAmount: line.contractAmount,
          percentComplete: line.approvedPercent,
          amountPreviouslyApproved: line.approvedAmount,
          amountCumulative: line.approvedAmount,
          amountPeriod: 0,
        })) ?? [];

  const periodWorks =
    isDraft && preview ? preview.worksPeriod : openClaim?.worksPeriod ?? 0;
  const periodPrelim =
    isDraft && preview
      ? preview.preliminaryPeriod
      : openClaim?.preliminaryPeriod ?? 0;
  const periodOhp =
    isDraft && preview
      ? preview.overheadProfitPeriod
      : openClaim?.overheadProfitPeriod ?? 0;
  const periodVat =
    isDraft && preview ? preview.vatPeriod : openClaim?.vatPeriod ?? 0;
  const periodGrand =
    isDraft && preview ? preview.grandPeriod : openClaim?.grandPeriod ?? 0;

  return (
    <section className="card progress-claims-panel" id="progress-claims">
      <div className="progress-claims-header">
        <div>
          <h2 className="section-title">{t('progressSection.title')}</h2>
          <p className="muted progress-claims-hint">
            {t('progressSection.hint')}
          </p>
        </div>
        {overview && (
          <div className="progress-claims-summary">
            <div>
              <span className="muted">{t('progressSection.approvedToDate')}</span>
              <strong>{formatThb(overview.approvedGrandCumulative)}</strong>
            </div>
            <div>
              <span className="muted">{t('progressSection.remaining')}</span>
              <strong>{formatThb(overview.remainingGrand)}</strong>
            </div>
            <div>
              <span className="muted">{t('progressSection.contractTotal')}</span>
              <strong>{formatThb(overview.contractGrandTotal)}</strong>
            </div>
          </div>
        )}
      </div>

      {loading && <p className="muted">{t('common.loading')}</p>}

      {!loading && overview && (
        <>
          {isContractor && !openClaim && (
            <div className="progress-claims-actions">
              <button
                type="button"
                className="primary"
                disabled={busy || overview.remainingGrand <= 0}
                onClick={() => void handleCreateDraft()}
              >
                {t('progressSection.startClaim')}
              </button>
              {overview.remainingGrand <= 0 && (
                <p className="muted">{t('progressSection.fullyClaimed')}</p>
              )}
            </div>
          )}

          {openClaim && (
            <div className="progress-claim-card">
              <div className="progress-claim-card-header">
                <h3>
                  {t('progressSection.claimNumber', {
                    n: openClaim.sequenceNumber,
                  })}
                </h3>
                <span className={`progress-claim-status progress-claim-status--${openClaim.status}`}>
                  {statusLabel(openClaim.status)}
                </span>
              </div>

              <div className="progress-claim-table-wrap">
                <table className="progress-claim-table">
                  <thead>
                    <tr>
                      <th>{t('progressSection.colTrade')}</th>
                      <th>{t('progressSection.colContract')}</th>
                      <th>{t('progressSection.colApproved')}</th>
                      <th>{t('progressSection.colPercent')}</th>
                      <th>{t('progressSection.colPeriod')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayLines.map((line) => (
                      <tr key={line.trade}>
                        <td>
                          <strong>
                            {formatTagLabel(line.trade, line.trade)}
                          </strong>
                          {line.description ? (
                            <span className="muted progress-claim-line-desc">
                              {line.description}
                            </span>
                          ) : null}
                        </td>
                        <td>{formatThb(line.contractAmount)}</td>
                        <td>
                          {formatThb(line.amountPreviouslyApproved)}
                          <span className="muted">
                            {' '}
                            (
                            {overview.baselineLines.find(
                              (b) => b.trade === line.trade,
                            )?.approvedPercent ?? 0}
                            %)
                          </span>
                        </td>
                        <td>
                          {isDraft && isContractor ? (
                            <input
                              type="number"
                              className="progress-claim-percent-input"
                              min={
                                overview.baselineLines.find(
                                  (b) => b.trade === line.trade,
                                )?.approvedPercent ?? 0
                              }
                              max={100}
                              step={1}
                              value={percentDraft[line.trade] ?? ''}
                              disabled={busy}
                              onChange={(e) =>
                                setPercentDraft((prev) => ({
                                  ...prev,
                                  [line.trade]: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            `${line.percentComplete}%`
                          )}
                        </td>
                        <td>{formatThb(line.amountPeriod)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <dl className="progress-claim-totals">
                <div>
                  <dt>{t('progressSection.worksPeriod')}</dt>
                  <dd>{formatThb(periodWorks)}</dd>
                </div>
                <div>
                  <dt>
                    {t('bid.preliminaryPercent')} ({overview.preliminaryPercent}
                    %)
                  </dt>
                  <dd>{formatThb(periodPrelim)}</dd>
                </div>
                <div>
                  <dt>
                    {t('bid.overheadProfitPercent')} (
                    {overview.overheadProfitPercent}%)
                  </dt>
                  <dd>{formatThb(periodOhp)}</dd>
                </div>
                <div>
                  <dt>
                    {t('bid.vatPercent')} ({overview.vatPercent}%)
                  </dt>
                  <dd>{formatThb(periodVat)}</dd>
                </div>
                <div className="progress-claim-totals-grand">
                  <dt>{t('progressSection.dueThisPeriod')}</dt>
                  <dd>{formatThb(periodGrand)}</dd>
                </div>
              </dl>

              {(isDraft && isContractor) || openClaim.note ? (
                <label className="progress-claim-note">
                  <span className="field-label">
                    {t('progressSection.note')}
                  </span>
                  {isDraft && isContractor ? (
                    <textarea
                      rows={2}
                      value={noteDraft}
                      disabled={busy}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder={t('progressSection.notePlaceholder')}
                    />
                  ) : (
                    <p className="progress-claim-note-text">{openClaim.note}</p>
                  )}
                </label>
              ) : null}

              {isDraft && isContractor && (
                <div className="progress-claims-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void handleSave()}
                  >
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={busy || periodGrand <= 0}
                    onClick={() => void handleSubmit()}
                  >
                    {t('progressSection.submitForApproval')}
                  </button>
                </div>
              )}

              {isSubmitted && isClient && (
                <div className="progress-claims-actions progress-claims-actions--review">
                  <label className="progress-claim-note">
                    <span className="field-label">
                      {t('progressSection.rejectReason')}
                    </span>
                    <input
                      type="text"
                      value={rejectReason}
                      disabled={busy}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={t('progressSection.rejectReasonPlaceholder')}
                    />
                  </label>
                  <div className="progress-claims-actions-row">
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => void handleReject(openClaim)}
                    >
                      {t('progressSection.reject')}
                    </button>
                    <button
                      type="button"
                      className="primary"
                      disabled={busy}
                      onClick={() => void handleApprove(openClaim)}
                    >
                      {t('progressSection.approve')}
                    </button>
                  </div>
                </div>
              )}

              {isSubmitted && isContractor && (
                <p className="muted">{t('progressSection.waitingApproval')}</p>
              )}
            </div>
          )}

          {overview.claims.filter((c) => c.status !== 'draft').length > 0 && (
            <div className="progress-claim-history">
              <h3 className="progress-claim-history-title">
                {t('progressSection.history')}
              </h3>
              <ul className="progress-claim-history-list">
                {overview.claims
                  .filter((c) => c.status !== 'draft')
                  .map((claim) => (
                    <li key={claim.id}>
                      <span>
                        {t('progressSection.claimNumber', {
                          n: claim.sequenceNumber,
                        })}
                      </span>
                      <span className={`progress-claim-status progress-claim-status--${claim.status}`}>
                        {statusLabel(claim.status)}
                      </span>
                      <strong>{formatThb(claim.grandPeriod)}</strong>
                      {claim.rejectionReason ? (
                        <span className="muted">{claim.rejectionReason}</span>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
