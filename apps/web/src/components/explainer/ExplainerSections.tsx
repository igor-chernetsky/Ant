'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export interface ExplainerStepItem {
  title: string;
  body: string;
}

export interface ExplainerBenefitItem {
  title: string;
  body: string;
}

export interface ExplainerFaqItem {
  question: string;
  answer: string;
}

export function ExplainerHero({
  kicker,
  title,
  lead,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  mockup,
}: {
  kicker: string;
  title: string;
  lead: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  mockup: ReactNode;
}) {
  return (
    <section className="explainer-hero">
      <div className="explainer-hero-copy">
        <p className="explainer-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="explainer-lead">{lead}</p>
        <div className="explainer-hero-actions">
          <Link href={primaryHref} className="primary">
            {primaryLabel}
          </Link>
          <Link href={secondaryHref} className="secondary">
            {secondaryLabel}
          </Link>
        </div>
      </div>
      <div className="explainer-hero-visual">{mockup}</div>
    </section>
  );
}

export function ExplainerSectionIntro({
  title,
  lead,
}: {
  title: string;
  lead?: string;
}) {
  return (
    <div className="explainer-section-intro">
      <h2 className="section-title">{title}</h2>
      {lead ? <p className="muted">{lead}</p> : null}
    </div>
  );
}

export function ExplainerSteps({
  title,
  lead,
  items,
}: {
  title: string;
  lead?: string;
  items: ExplainerStepItem[];
}) {
  return (
    <section className="explainer-section">
      <ExplainerSectionIntro title={title} lead={lead} />
      <div className="explainer-steps-grid">
        {items.map((item, index) => (
          <article key={item.title} className="explainer-step-card">
            <span className="explainer-step-index">{index + 1}</span>
            <h3>{item.title}</h3>
            <p className="muted">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ExplainerBenefits({
  title,
  lead,
  items,
}: {
  title: string;
  lead?: string;
  items: ExplainerBenefitItem[];
}) {
  return (
    <section className="explainer-section">
      <ExplainerSectionIntro title={title} lead={lead} />
      <div className="explainer-benefits-grid">
        {items.map((item) => (
          <article key={item.title} className="explainer-benefit-card">
            <div className="explainer-benefit-icon" aria-hidden>
              <span />
            </div>
            <h3>{item.title}</h3>
            <p className="muted">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ExplainerFaq({
  title,
  lead,
  items,
}: {
  title: string;
  lead?: string;
  items: ExplainerFaqItem[];
}) {
  return (
    <section className="explainer-section">
      <ExplainerSectionIntro title={title} lead={lead} />
      <div className="explainer-faq-list">
        {items.map((item) => (
          <article key={item.question} className="explainer-faq-card">
            <h3>{item.question}</h3>
            <p className="muted">{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ExplainerCta({
  title,
  body,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: {
  title: string;
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
}) {
  return (
    <section className="explainer-cta-card">
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="muted">{body}</p>
      </div>
      <div className="explainer-cta-actions">
        <Link href={primaryHref} className="primary">
          {primaryLabel}
        </Link>
        <Link href={secondaryHref} className="text-link">
          {secondaryLabel}
        </Link>
      </div>
    </section>
  );
}

export function ExplainerMockup({
  audience,
  eyebrow,
  headline,
  detail,
  metricTitle,
  metricBody,
  pills,
}: {
  audience: 'clients' | 'contractors';
  eyebrow: string;
  headline: string;
  detail: string;
  metricTitle: string;
  metricBody: string;
  pills: string[];
}) {
  return (
    <div className={`explainer-mockup explainer-mockup--${audience}`}>
      <div className="explainer-mockup-window">
        <div className="explainer-mockup-toolbar">
          <span />
          <span />
          <span />
        </div>
        <div className="explainer-mockup-body">
          <div className="explainer-mockup-main">
            <div className="explainer-mockup-panel explainer-mockup-panel--hero">
              <p className="explainer-mockup-eyebrow">{eyebrow}</p>
              <strong>{headline}</strong>
              <p>{detail}</p>
            </div>
            <div className="explainer-mockup-grid">
              <div className="explainer-mockup-panel">
                <strong>{pills[0]}</strong>
                <div className="explainer-mockup-lines">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="explainer-mockup-panel">
                <strong>{pills[1]}</strong>
                <div className="explainer-mockup-badges">
                  {pills.slice(2).map((pill) => (
                    <span key={pill}>{pill}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="explainer-mockup-side">
            <div className="explainer-mockup-panel explainer-mockup-panel--metric">
              <strong>{metricTitle}</strong>
              <p>{metricBody}</p>
            </div>
            <div className="explainer-mockup-panel explainer-mockup-panel--stack">
              <div className="explainer-mockup-lines">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
