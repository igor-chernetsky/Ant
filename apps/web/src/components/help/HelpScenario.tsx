'use client';

import Link from 'next/link';

interface HelpScenarioProps {
  id: string;
  title: string;
  steps: string[];
  actionHref?: string;
  actionLabel?: string;
}

export function HelpScenario({
  id,
  title,
  steps,
  actionHref,
  actionLabel,
}: HelpScenarioProps) {
  return (
    <article id={id} className="help-scenario card">
      <h3 className="help-scenario-title">{title}</h3>
      <ol className="help-scenario-steps">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="secondary help-scenario-action">
          {actionLabel}
        </Link>
      )}
    </article>
  );
}
