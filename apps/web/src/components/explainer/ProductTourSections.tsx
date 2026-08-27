'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from '@/components/LocaleProvider';

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
  band?: boolean;
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
    <section className="product-tour-hero product-tour-wrap">
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
  ariaLabel,
}: {
  steps: TourWorkflowStep[];
  activeId: string | null;
  onSelect: (id: string) => void;
  ariaLabel: string;
}) {
  const { t } = useTranslation();
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === activeId),
  );
  const activeStep = steps[activeIndex] ?? steps[0];
  const progress =
    steps.length <= 1 ? 100 : (activeIndex / (steps.length - 1)) * 100;

  const goPrev = () => {
    if (activeIndex > 0) onSelect(steps[activeIndex - 1]!.id);
  };
  const goNext = () => {
    if (activeIndex < steps.length - 1) onSelect(steps[activeIndex + 1]!.id);
  };

  return (
    <nav
      id="tour-workflow"
      className="product-tour-workflow-nav"
      aria-label={ariaLabel}
    >
      <div className="product-tour-workflow-inner">
        <div className="product-tour-workflow-track">
          <div className="product-tour-workflow-rail" aria-hidden>
            <span
              className="product-tour-workflow-rail-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          {steps.map((step, index) => {
            const isActive = activeId === step.id;
            const isDone = index < activeIndex;
            return (
              <button
                key={step.id}
                type="button"
                className={`product-tour-workflow-step${
                  isActive ? ' product-tour-workflow-step--active' : ''
                }${isDone ? ' product-tour-workflow-step--done' : ''}`}
                aria-current={isActive ? 'step' : undefined}
                aria-label={step.label}
                onClick={() => onSelect(step.id)}
              >
                <span className="product-tour-workflow-number">{step.number}</span>
                <span className="product-tour-workflow-label">{step.label}</span>
              </button>
            );
          })}
        </div>

        <div className="product-tour-workflow-mobile">
          <div className="product-tour-workflow-mobile-bar">
            <button
              type="button"
              className="product-tour-workflow-mobile-arrow"
              aria-label={t('explainer.workflowPrevAria')}
              disabled={activeIndex <= 0}
              onClick={goPrev}
            >
              <span aria-hidden>‹</span>
            </button>
            <div className="product-tour-workflow-mobile-current">
              <span className="product-tour-workflow-mobile-count">
                {t('explainer.workflowStepOf', {
                  current: String(activeIndex + 1),
                  total: String(steps.length),
                })}
              </span>
              {activeStep ? (
                <span className="product-tour-workflow-mobile-label">
                  {activeStep.label}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="product-tour-workflow-mobile-arrow"
              aria-label={t('explainer.workflowNextAria')}
              disabled={activeIndex >= steps.length - 1}
              onClick={goNext}
            >
              <span aria-hidden>›</span>
            </button>
          </div>
          <div className="product-tour-workflow-mobile-chips" role="list">
            {steps.map((step, index) => {
              const isActive = activeId === step.id;
              const isDone = index < activeIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  role="listitem"
                  className={`product-tour-workflow-mobile-chip${
                    isActive ? ' product-tour-workflow-mobile-chip--active' : ''
                  }${isDone ? ' product-tour-workflow-mobile-chip--done' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={step.label}
                  onClick={() => onSelect(step.id)}
                >
                  {step.number}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

export function useProductTourLayout() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.site-header');
    const nav = document.querySelector<HTMLElement>('.product-tour-workflow-nav');
    const root = document.documentElement;

    const apply = () => {
      root.style.setProperty(
        '--product-tour-header-height',
        `${header?.offsetHeight ?? 0}px`,
      );
      root.style.setProperty(
        '--product-tour-nav-height',
        `${nav?.offsetHeight ?? 0}px`,
      );
    };

    apply();
    const observer = new ResizeObserver(apply);
    if (header) observer.observe(header);
    if (nav) observer.observe(nav);
    window.addEventListener('resize', apply);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', apply);
      root.style.removeProperty('--product-tour-header-height');
      root.style.removeProperty('--product-tour-nav-height');
    };
  }, []);
}

export function useWorkflowScrollSpy(sectionIds: readonly string[]) {
  const [activeId, setActiveId] = useState<string | null>(sectionIds[0] ?? null);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);

    if (elements.length === 0) return;

    const headerH = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        '--product-tour-header-height',
      ),
    );
    const navH = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        '--product-tour-nav-height',
      ),
    );
    const topOffset =
      (Number.isFinite(headerH) ? headerH : 64) +
      (Number.isFinite(navH) ? navH : 88) +
      8;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: `-${topOffset}px 0px -45% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const el of elements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sectionIds]);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
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
  band = false,
}: TourSectionConfig) {
  return (
    <section
      id={id}
      className={`product-tour-section product-tour-wrap${
        reverse ? ' product-tour-section--reverse' : ''
      }${fullWidth ? ' product-tour-section--full' : ''}${
        band ? ' product-tour-section--band' : ''
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
    <section className="product-tour-differentiators product-tour-wrap">
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
    <section className="product-tour-faq product-tour-wrap">
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
    <section className="product-tour-cta-slot product-tour-wrap">
      <div className="product-tour-cta">
        <h2 className="section-title">{title}</h2>
        <div className="product-tour-cta-actions">
          <Link href={primaryHref} className="primary">
            {primaryLabel}
          </Link>
          <Link href={secondaryHref} className="secondary">
            {secondaryLabel}
          </Link>
        </div>
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
    <section
      id={id}
      className="product-tour-section product-tour-section--split product-tour-wrap"
    >
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
