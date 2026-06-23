import { formatConfidence } from '@/lib/estimate';

interface DocumentInsightCollapsibleProps {
  insight: {
    summary: string;
    confidence: number;
    provider: 'openai' | 'fallback';
    omittedNote?: string;
    keyFacts?: string[];
  };
}

export function DocumentInsightCollapsible({
  insight,
}: DocumentInsightCollapsibleProps) {
  return (
    <details className="doc-insight-details">
      <summary className="doc-insight-details-summary">AI analysis</summary>
      <div className="doc-insight-details-body">
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
          {formatConfidence(insight.confidence)} confidence · {insight.provider}
        </p>
      </div>
    </details>
  );
}
