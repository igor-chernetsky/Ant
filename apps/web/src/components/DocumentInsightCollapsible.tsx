'use client';

import { formatConfidence } from '@/lib/estimate';
import { useTranslation } from '@/components/LocaleProvider';

interface ScopePackage {
  trade: string;
  description: string;
  quantity?: number;
  unit?: string;
  areaSqm?: number;
}

interface DocumentInsightCollapsibleProps {
  insight?: {
    summary: string;
    confidence: number;
    provider: 'openai' | 'fallback';
    omittedNote?: string;
    keyFacts?: string[];
  } | null;
  scopePackages?: ScopePackage[];
}

function ScopePackagesList({ packages }: { packages: ScopePackage[] }) {
  const { t } = useTranslation();

  if (packages.length === 0) {
    return null;
  }

  return (
    <div className="doc-tile-scope">
      <p className="doc-tile-scope-label">{t('documents.inferredScope')}</p>
      <ul className="doc-tile-scope-list">
        {packages.map((pkg, index) => (
          <li key={`${pkg.trade}-${index}`} className="doc-tile-scope-item">
            <span className="package-trade">{pkg.trade}</span>
            <span>{pkg.description}</span>
            {(pkg.quantity ?? pkg.areaSqm) != null && (
              <span className="muted package-qty">
                {pkg.quantity ?? pkg.areaSqm}{' '}
                {pkg.unit ?? (pkg.areaSqm != null ? t('documents.sqm') : '')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DocumentInsightCollapsible({
  insight,
  scopePackages = [],
}: DocumentInsightCollapsibleProps) {
  const { t } = useTranslation();
  const scopeCount = scopePackages.length;

  if (!insight && scopeCount === 0) {
    return null;
  }

  const summaryLabel = insight
    ? t('documents.aiAnalysis')
    : t('documents.inferredScope');

  return (
    <details className="doc-insight-details">
      <summary className="doc-insight-details-summary">
        {summaryLabel}
        {scopeCount > 0 && (
          <span className="doc-insight-scope-count">
            {' '}
            · {t('documents.inferredScopeCount', { count: scopeCount })}
          </span>
        )}
      </summary>
      <div className="doc-insight-details-body">
        {insight && (
          <>
            <p className="doc-insight-summary">{insight.summary}</p>
            {insight.keyFacts && insight.keyFacts.length > 0 && (
              <ul className="doc-insight-facts">
                {insight.keyFacts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            )}
            {insight.omittedNote && (
              <p className="muted doc-insight-omitted">{insight.omittedNote}</p>
            )}
            <p className="muted doc-insight-meta">
              {formatConfidence(insight.confidence)} {t('common.confidence')} ·{' '}
              {insight.provider}
            </p>
          </>
        )}
        <ScopePackagesList packages={scopePackages} />
      </div>
    </details>
  );
}
