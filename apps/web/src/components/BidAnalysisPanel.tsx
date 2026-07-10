'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  fetchBidAnalysis,
  runBidAnalysis,
  type BidAnalysisState,
} from '@/lib/tendering';

interface BidAnalysisPanelProps {
  projectId: string;
  submittedBidCount: number;
  onAnalysisUpdated?: () => void;
}

export function BidAnalysisPanel({
  projectId,
  submittedBidCount,
  onAnalysisUpdated,
}: BidAnalysisPanelProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<BidAnalysisState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBidAnalysis(projectId);
      setState(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('bidAnalysis.loadFailed'));
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadAnalysis();
  }, [loadAnalysis]);

  const handleAnalyze = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await runBidAnalysis(projectId);
      setState(data);
      onAnalysisUpdated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('bidAnalysis.analyzeFailed'));
    } finally {
      setBusy(false);
    }
  };

  const canRun = state?.canAnalyze ?? submittedBidCount >= 2;
  const showButton = submittedBidCount >= 2;
  const analysis = state?.analysis;

  return (
    <section className="card bid-analysis-card">
      <div className="bid-analysis-header">
        <div>
          <h2 className="section-title">{t('bidAnalysis.title')}</h2>
          <p className="muted bid-analysis-hint">
            {t('bidAnalysis.hint')}
          </p>
        </div>
        {showButton && (
          <button
            type="button"
            className="primary"
            disabled={busy || loading || !canRun}
            onClick={() => void handleAnalyze()}
            title={
              state?.analysisUpToDate
                ? t('bidAnalysis.analysisCurrent')
                : undefined
            }
          >
            {busy
              ? t('bidAnalysis.analyzing')
              : state?.analysisUpToDate
                ? t('bidAnalysis.analysisUpToDate')
                : t('bidAnalysis.analyzeBids')}
          </button>
        )}
      </div>

      {submittedBidCount < 2 && (
        <p className="muted bid-analysis-empty">
          {t('bidAnalysis.needTwoBids')}
        </p>
      )}

      {loading && <p className="muted">{t('bidAnalysis.loading')}</p>}
      {error && <p className="form-error">{error}</p>}

      {analysis && (
        <div className="bid-analysis-result">
          <div className="bid-analysis-recommendation">
            <p className="bid-analysis-summary">{analysis.summary}</p>
            {analysis.recommendedCompanyName && (
              <p className="bid-analysis-pick">
                {t('bidAnalysis.suggested')}{' '}
                <strong>{analysis.recommendedCompanyName}</strong>
                <span className="muted bid-analysis-confidence">
                  {' '}
                  {t('bidAnalysis.confidenceProvider', {
                    confidence: Math.round(analysis.confidence * 100),
                    provider: analysis.provider,
                  })}
                </span>
              </p>
            )}
          </div>

          <div className="bid-analysis-reasoning">
            <h3 className="bid-analysis-subtitle">{t('bidAnalysis.reasoning')}</h3>
            <p>{analysis.reasoning}</p>
          </div>

          {analysis.comparisons.length > 0 && (
            <div className="bid-analysis-comparisons">
              <h3 className="bid-analysis-subtitle">{t('bidAnalysis.perContractor')}</h3>
              <ul className="bid-analysis-comparison-list">
                {analysis.comparisons.map((item) => (
                  <li key={item.bidId} className="bid-analysis-comparison-item">
                    <strong>{item.companyName ?? t('common.contractor')}</strong>
                    {item.strengths.length > 0 && (
                      <div className="bid-analysis-points bid-analysis-points-pro">
                        <span className="bid-analysis-points-label">{t('bidAnalysis.strengths')}</span>
                        <ul>
                          {item.strengths.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {item.weaknesses.length > 0 && (
                      <div className="bid-analysis-points bid-analysis-points-con">
                        <span className="bid-analysis-points-label">{t('bidAnalysis.weaknesses')}</span>
                        <ul>
                          {item.weaknesses.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {item.riskFlags.length > 0 && (
                      <div className="bid-analysis-points bid-analysis-points-risk">
                        <span className="bid-analysis-points-label">{t('bidAnalysis.risks')}</span>
                        <ul>
                          {item.riskFlags.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state?.generatedAt && (
            <p className="muted bid-analysis-generated">
              {t('bidAnalysis.generated', {
                date: new Date(state.generatedAt).toLocaleString(),
              })}
            </p>
          )}
        </div>
      )}

      {!loading && !analysis && submittedBidCount >= 2 && !error && (
        <p className="muted bid-analysis-empty">
          {t('bidAnalysis.runAnalysis')}
        </p>
      )}
    </section>
  );
}
