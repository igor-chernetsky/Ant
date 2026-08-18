'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface TourWorkflowStep {
  id: string;
  label: string;
  number: string;
}

export interface TourDifferentiatorItem {
  title: string;
  body: string;
}

export interface TourFaqItem {
  question: string;
  answer: string;
}

export interface TourSectionConfig {
  id: string;
  title: string;
  body: string;
  note?: string;
  preview: ReactNode;
  reverse?: boolean;
  fullWidth?: boolean;
}

export function ProductTourHero({
  kicker,
  title,
  lead,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  visual,
}: {
  kicker: string;
  title: string;
  lead: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  visual: ReactNode;
}) {
  return (
    <section className="product-tour-hero">
      <div className="product-tour-hero-copy">
        <p className="product-tour-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="product-tour-lead">{lead}</p>
        <div className="product-tour-hero-actions">
          <Link href={primaryHref} className="primary">
            {primaryLabel}
          </Link>
          <Link href={secondaryHref} className="secondary">
            {secondaryLabel}
          </Link>
        </div>
      </div>
      <div className="product-tour-hero-visual">{visual}</div>
    </section>
  );
}

export function ProductTourWorkflowNav({
  steps,
  activeId,
  onSelect,
}: {
  steps: TourWorkflowStep[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      id="tour-workflow"
      className="product-tour-workflow-nav"
      aria-label="Workflow steps"
    >
      <div className="product-tour-workflow-track">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={`product-tour-workflow-step${
              activeId === step.id ? ' product-tour-workflow-step--active' : ''
            }`}
            onClick={() => onSelect(step.id)}
          >
            <span className="product-tour-workflow-number">{step.number}</span>
            <span className="product-tour-workflow-label">{step.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function useWorkflowScrollSpy(sectionIds: string[]) {
  const [activeId, setActiveId] = useState<string | null>(sectionIds[0] ?? null);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    for (const el of elements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sectionIds]);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  }, []);

  return { activeId, scrollTo };
}

export function ProductTourSection({
  id,
  title,
  body,
  note,
  preview,
  reverse = false,
  fullWidth = false,
}: TourSectionConfig) {
  return (
    <section
      id={id}
      className={`product-tour-section${reverse ? ' product-tour-section--reverse' : ''}${
        fullWidth ? ' product-tour-section--full' : ''
      }`}
    >
      <div className="product-tour-section-copy">
        <h2 className="section-title">{title}</h2>
        <p className="product-tour-section-body">{body}</p>
        {note ? <p className="muted product-tour-section-note">{note}</p> : null}
      </div>
      <div className="product-tour-section-visual">{preview}</div>
    </section>
  );
}

export function ProductTourDifferentiators({
  title,
  items,
}: {
  title: string;
  items: TourDifferentiatorItem[];
}) {
  return (
    <section className="product-tour-differentiators">
      <h2 className="section-title product-tour-differentiators-title">{title}</h2>
      <div className="product-tour-differentiators-grid">
        {items.map((item) => (
          <article key={item.title} className="product-tour-differentiator">
            <div className="product-tour-differentiator-icon" aria-hidden>
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

export function ProductTourFaq({
  title,
  items,
}: {
  title: string;
  items: TourFaqItem[];
}) {
  return (
    <section className="product-tour-faq">
      <h2 className="section-title">{title}</h2>
      <div className="product-tour-faq-list">
        {items.map((item) => (
          <details key={item.question} className="product-tour-faq-item">
            <summary>{item.question}</summary>
            <p className="muted">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ProductTourCta({
  title,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: {
  title: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
}) {
  return (
    <section className="product-tour-cta">
      <h2 className="section-title">{title}</h2>
      <div className="product-tour-cta-actions">
        <Link href={primaryHref} className="primary">
          {primaryLabel}
        </Link>
        <Link href={secondaryHref} className="secondary">
          {secondaryLabel}
        </Link>
      </div>
    </section>
  );
}

export function ProductTourSplitSection({
  id,
  title,
  body,
  note,
  left,
  right,
}: {
  id: string;
  title: string;
  body: string;
  note?: string;
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <section id={id} className="product-tour-section product-tour-section--split">
      <div className="product-tour-section-copy">
        <h2 className="section-title">{title}</h2>
        <p className="product-tour-section-body">{body}</p>
        {note ? <p className="muted product-tour-section-note">{note}</p> : null}
      </div>
      <div className="product-tour-split-grid">
        <div>{left}</div>
        <div>{right}</div>
      </div>
    </section>
  );
}
