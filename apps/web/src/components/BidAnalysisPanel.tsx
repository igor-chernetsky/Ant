'use client';

import { useCallback, useEffect, useState } from 'react';
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
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
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
      setError(err instanceof Error ? err.message : 'Failed to analyze bids');
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
          <h2 className="section-title">AI bid analysis</h2>
          <p className="muted bid-analysis-hint">
            Independent review of price, scope, timeline, and risks across all
            submitted bids.
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
                ? 'Analysis is current for these bids'
                : undefined
            }
          >
            {busy
              ? 'Analyzing…'
              : state?.analysisUpToDate
                ? 'Analysis up to date'
                : 'Analyze bids'}
          </button>
        )}
      </div>

      {submittedBidCount < 2 && (
        <p className="muted bid-analysis-empty">
          At least two submitted bids are required for AI analysis.
        </p>
      )}

      {loading && <p className="muted">Loading analysis…</p>}
      {error && <p className="form-error">{error}</p>}

      {analysis && (
        <div className="bid-analysis-result">
          <div className="bid-analysis-recommendation">
            <p className="bid-analysis-summary">{analysis.summary}</p>
            {analysis.recommendedCompanyName && (
              <p className="bid-analysis-pick">
                Suggested:{' '}
                <strong>{analysis.recommendedCompanyName}</strong>
                <span className="muted bid-analysis-confidence">
                  {' '}
                  · {Math.round(analysis.confidence * 100)}% confidence ·{' '}
                  {analysis.provider}
                </span>
              </p>
            )}
          </div>

          <div className="bid-analysis-reasoning">
            <h3 className="bid-analysis-subtitle">Reasoning</h3>
            <p>{analysis.reasoning}</p>
          </div>

          {analysis.comparisons.length > 0 && (
            <div className="bid-analysis-comparisons">
              <h3 className="bid-analysis-subtitle">Per contractor</h3>
              <ul className="bid-analysis-comparison-list">
                {analysis.comparisons.map((item) => (
                  <li key={item.bidId} className="bid-analysis-comparison-item">
                    <strong>{item.companyName ?? 'Contractor'}</strong>
                    {item.strengths.length > 0 && (
                      <div className="bid-analysis-points bid-analysis-points-pro">
                        <span className="bid-analysis-points-label">Strengths</span>
                        <ul>
                          {item.strengths.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {item.weaknesses.length > 0 && (
                      <div className="bid-analysis-points bid-analysis-points-con">
                        <span className="bid-analysis-points-label">Weaknesses</span>
                        <ul>
                          {item.weaknesses.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {item.riskFlags.length > 0 && (
                      <div className="bid-analysis-points bid-analysis-points-risk">
                        <span className="bid-analysis-points-label">Risks</span>
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
              Generated {new Date(state.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {!loading && !analysis && submittedBidCount >= 2 && !error && (
        <p className="muted bid-analysis-empty">
          Run analysis to get a recommendation with argumentation.
        </p>
      )}
    </section>
  );
}
