'use client';

import { useState } from 'react';
import { ProjectHeroSidebar } from '@/components/ProjectHero';
import { ProjectBriefCard } from '@/components/ProjectBriefCard';
import { BidsCompareTable } from '@/components/BidsCompareTable';
import { BidProposalSummary } from '@/components/BidProposalSummary';
import { ProjectTile } from '@/components/ProjectTile';
import { ContractSigningStatusPill } from '@/components/ContractSigningStatusPill';
import { ContractSigningPartiesInline } from '@/components/ContractSigningPartiesInline';
import { useTranslation } from '@/components/LocaleProvider';
import { formatConfidence } from '@/lib/estimate';
import {
  demoBids,
  demoBrief,
  demoCompareBreakdown,
  demoContractAwaitingContractor,
  demoClarificationQuestions,
  demoDocuments,
  demoMarketplaceTiles,
  demoOwnedProjectTile,
  demoProject,
  demoProjectTags,
  demoTenderMeta,
  DEMO_ESTIMATE_AFTER_MID,
  DEMO_ESTIMATE_BEFORE_MID,
  DEMO_PROJECT_ID,
} from '@/lib/marketing/demo-fixtures';
import { ProductPreviewFrame, PreviewCallout } from '@/components/marketing/ProductPreviewFrame';

export function ClientHeroPreview({
  callouts,
}: {
  callouts: { scope: string; estimate: string; tender: string };
}) {
  return (
    <ProductPreviewFrame className="product-preview-frame--hero">
      <div className="product-preview-hero-layout">
        <PreviewCallout label={callouts.scope} position="top-left" />
        <PreviewCallout label={callouts.estimate} position="top-right" />
        <PreviewCallout label={callouts.tender} position="bottom-right" />
        <div className="product-preview-hero-main">
          <h3 className="product-preview-project-title">{demoProject.title}</h3>
          <p className="muted product-preview-project-desc">{demoProject.description}</p>
          <ProjectBriefCard brief={demoBrief} compact />
        </div>
        <ProjectHeroSidebar
          project={demoProject}
          estimateMidAmountThb={demoProject.estimate?.totals.midAmount}
          tags={demoProjectTags}
          showTags
        />
      </div>
    </ProductPreviewFrame>
  );
}

export function ClientCreatePreview() {
  const { t } = useTranslation();

  return (
    <ProductPreviewFrame>
      <div className="product-preview-stack">
        <div className="card product-preview-intake-card">
          <p className="product-preview-field-label">{t('createProject.titleLabel')}</p>
          <p className="product-preview-field-value">{demoProject.title}</p>
          <p className="product-preview-field-label">{t('createProject.descriptionLabel')}</p>
          <p className="muted product-preview-field-value product-preview-field-value--multiline">
            {demoProject.description}
          </p>
          <div className="product-preview-tag-row">
            {demoProjectTags.slice(0, 3).map((tag) => (
              <span key={tag.slug} className="tag-pill tag-pill-client">
                {tag.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ProductPreviewFrame>
  );
}

export function ClientAnalyzePreview() {
  const { t } = useTranslation();

  return (
    <ProductPreviewFrame>
      <div className="product-preview-ai-flow">
        <div className="product-preview-ai-flow-col">
          {demoDocuments.map((doc) => (
            <article key={doc.id} className="card doc-tile product-preview-doc-tile">
              <div className="doc-tile-header">
                <span className="doc-tile-ext">
                  {doc.fileName.split('.').pop()}
                </span>
                <strong>{doc.fileName}</strong>
              </div>
              <p className="muted doc-tile-meta">
                {(doc.sizeBytes / 1_000_000).toFixed(1)} MB
              </p>
            </article>
          ))}
        </div>
        <div className="product-preview-ai-flow-bridge" aria-hidden>
          <span className="product-preview-ai-flow-node-label">
            {t('explainer.clients.previews.analyzeAi')}
          </span>
        </div>
        <div className="product-preview-ai-flow-col">
          <article className="card product-preview-ai-output">
            <p className="product-preview-field-label">
              {t('explainer.clients.previews.analyzeScope')}
            </p>
            {demoBrief.packages && (
              <ul className="doc-tile-scope-list">
                {demoBrief.packages.map((pkg, index) => (
                  <li key={`${pkg.trade}-${index}`} className="doc-tile-scope-item">
                    <span className="package-trade">{pkg.trade}</span>
                    <span>{pkg.description}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="product-preview-tag-row">
              {demoProjectTags.map((tag) => (
                <span
                  key={tag.slug}
                  className={`tag-pill${tag.source === 'client' ? ' tag-pill-client' : ' tag-pill-ai'}`}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          </article>
          <article className="card product-preview-ai-output">
            <p className="product-preview-field-label">
              {t('explainer.clients.previews.analyzeQuestions')}
            </p>
            <ul className="product-preview-ai-questions">
              {demoClarificationQuestions.slice(0, 2).map((question) => (
                <li key={question.id}>{question.questionText}</li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </ProductPreviewFrame>
  );
}

export function ClientClarifyPreview() {
  const { t, locale } = useTranslation();
  const [choice, setChoice] = useState<'renovate' | 'replace'>('replace');
  const money = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(amount);
  const nextMid =
    choice === 'replace' ? DEMO_ESTIMATE_AFTER_MID : DEMO_ESTIMATE_BEFORE_MID;

  return (
    <ProductPreviewFrame interactive>
        <article className="card product-preview-refine-question">
          <p className="product-preview-field-label">
            {t('estimateSection.refineTitle')}
          </p>
          <p className="product-preview-refine-prompt">
            {t('explainer.clients.previews.refineQuestion')}
          </p>
          <div className="product-preview-refine-options">
            <button
              type="button"
              className={`product-preview-refine-option${
                choice === 'renovate' ? ' product-preview-refine-option--active' : ''
              }`}
              onClick={() => setChoice('renovate')}
            >
              {t('explainer.clients.previews.optionRenovate')}
            </button>
            <button
              type="button"
              className={`product-preview-refine-option${
                choice === 'replace' ? ' product-preview-refine-option--active' : ''
              }`}
              onClick={() => setChoice('replace')}
            >
              {t('explainer.clients.previews.optionReplace')}
            </button>
          </div>
        </article>
        <article className="card product-preview-refine-result">
          <p className="product-preview-field-label">
            {t('explainer.clients.previews.estimateUpdated')}
          </p>
          <p className="product-preview-refine-delta">
            <span className="product-preview-refine-previous">
              {money(DEMO_ESTIMATE_BEFORE_MID)}
            </span>
            <span aria-hidden>→</span>
            <strong>{money(nextMid)}</strong>
          </p>
          <p className="muted product-preview-estimate-note">
            {formatConfidence(choice === 'replace' ? 0.8 : 0.64)}{' '}
            {t('estimateSection.confidence')}
          </p>
          <p className="product-preview-refine-brief">
            {t('explainer.clients.previews.briefUpdated')}
          </p>
        </article>
      </div>
    </ProductPreviewFrame>
  );
}

export function ClientEstimatePreview() {
  const { t, locale } = useTranslation();
  const estimate = demoProject.estimate!;
  const money = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <ProductPreviewFrame>
      <div className="card product-preview-estimate-card">
        <p className="product-preview-field-label">{t('projectHero.ballparkMidpoint')}</p>
        <p className="product-preview-estimate-value">
          {money(estimate.totals.midAmount)}
        </p>
        <p className="product-preview-estimate-range">
          {money(estimate.totals.minAmount)}
          {' – '}
          {money(estimate.totals.maxAmount)}
        </p>
        <p className="muted product-preview-estimate-note">
          {t('projectHero.ballparkExcludesAdjustments')}
        </p>
        <div className="product-preview-confidence">
          <span className="readiness-badge">
            {formatConfidence(estimate.confidence)} {t('estimateSection.confidence')}
          </span>
        </div>
        <ul className="estimate-lines product-preview-estimate-lines">
          {estimate.lines.map((line, index) => (
            <li key={`${line.trade}-${index}`} className="estimate-line">
              <div>
                <strong>{line.description}</strong>
                <span className="muted estimate-line-trade">{line.trade}</span>
              </div>
              <div className="estimate-line-actions">
                <span className="estimate-line-amount">
                  {money(line.lineMin)} – {money(line.lineMax)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ProductPreviewFrame>
  );
}

export function ClientTenderPreview() {
  const { t } = useTranslation();
  const answeredCount = demoClarificationQuestions.filter((q) => q.answer?.trim()).length;

  return (
    <ProductPreviewFrame>
      <div className="card tender-card tender-summary-card product-preview-tender">
        <div className="meta-grid tender-meta tender-summary-meta">
          <div>
            <span className="muted">{t('tenderCard.collectingQuestions')}</span>
            <strong>{t('projectStatus.in_tender')}</strong>
          </div>
          <div>
            <span className="muted">{t('tenderCard.applications')}</span>
            <strong>
              {demoTenderMeta.applicationsCount} {t('tenderCard.application_other')}
            </strong>
          </div>
          <div>
            <span className="muted">{t('tenderCard.proposals')}</span>
            <strong>
              {demoTenderMeta.proposalsCount} {t('tenderCard.proposal_other')}
            </strong>
          </div>
        </div>
        <p className="muted client-clarification-readonly-meta">
          {t('clarificationClient.answeredOf', {
            answered: answeredCount,
            total: demoClarificationQuestions.length,
          })}
        </p>
        <ul className="client-clarification-readonly-list product-preview-tender-questions">
          {demoClarificationQuestions.map((question, index) => (
            <li key={question.id}>
              <span className="client-clarification-readonly-question">
                <span className="client-clarification-index">{index + 1}.</span>
                {question.questionText}
              </span>
              {question.askedByCount && question.askedByCount > 1 ? (
                <span className="muted product-preview-grouped-note">
                  {t('clarificationClient.askedBy')} {question.askedByCount}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </ProductPreviewFrame>
  );
}

export function ClientComparePreview() {
  return (
    <ProductPreviewFrame compact>
      <div className="product-preview-compare">
        <BidsCompareTable
          bids={demoBids}
          ballparkMid={demoProject.estimate?.totals.midAmount}
          defaultCostBreakdown={demoCompareBreakdown}
        />
      </div>
    </ProductPreviewFrame>
  );
}

export function ClientProposalDetailPreview() {
  return (
    <ProductPreviewFrame>
      <div className="card bid-application-card product-preview-proposal">
        <BidProposalSummary
          bid={demoBids[0]}
          ballparkMid={demoProject.estimate?.totals.midAmount}
          detailsOnly
        />
      </div>
    </ProductPreviewFrame>
  );
}

export function ClientSignPreview() {
  return (
    <ProductPreviewFrame>
      <div className="card contract-signing-panel product-preview-signing">
        <ContractSigningStatusPill contract={demoContractAwaitingContractor} />
        <ContractSigningPartiesInline contract={demoContractAwaitingContractor} />
      </div>
    </ProductPreviewFrame>
  );
}

export function ClientSignFlowPreview({
  steps,
}: {
  steps: string[];
}) {
  return (
    <div className="product-tour-flow product-tour-flow--horizontal product-tour-flow--sign">
      {steps.map((step, index) => (
        <div key={step} className="product-tour-flow-step">
          <span
            className={`product-tour-flow-node${
              index === 0 ? ' product-tour-flow-node--active' : ''
            }`}
          >
            {index + 1}
          </span>
          <span className="product-tour-flow-label">{step}</span>
          {index < steps.length - 1 && (
            <span className="product-tour-flow-arrow" aria-hidden>
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function ClientMarketplacePreview() {
  return (
    <ProductPreviewFrame>
      <div className="product-preview-tile-grid">
        {demoMarketplaceTiles.slice(0, 2).map((project) => (
          <div key={project.id} className="product-preview-tile-wrap">
            <ProjectTile project={project} isOwned={project.id === DEMO_PROJECT_ID} />
          </div>
        ))}
      </div>
    </ProductPreviewFrame>
  );
}
