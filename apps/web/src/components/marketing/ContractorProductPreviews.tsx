'use client';

import { ContractorApplicationTile } from '@/components/ContractorApplicationTile';
import { BidProposalSummary } from '@/components/BidProposalSummary';
import { ProjectTile } from '@/components/ProjectTile';
import { ProjectHeroSidebar } from '@/components/ProjectHero';
import { ProjectBriefCard } from '@/components/ProjectBriefCard';
import { ContractSigningStatusPill } from '@/components/ContractSigningStatusPill';
import { ContractSigningPartiesInline } from '@/components/ContractSigningPartiesInline';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import {
  demoContractFullySigned,
  demoContractorProfilePreview,
} from '@/lib/marketing/demo-fixtures';
import { useLocalizedDemoContent } from '@/lib/marketing/useLocalizedDemoContent';
import { ProductPreviewFrame } from '@/components/marketing/ProductPreviewFrame';

export function ContractorHeroPreview() {
  const { marketplaceTiles } = useLocalizedDemoContent();

  return (
    <ProductPreviewFrame className="product-preview-frame--hero">
      <div className="product-preview-tile-grid product-preview-tile-grid--marketplace">
        {marketplaceTiles.map((project) => (
          <div key={project.id} className="product-preview-tile-wrap">
            <ProjectTile project={project} />
          </div>
        ))}
      </div>
    </ProductPreviewFrame>
  );
}

export function ContractorProfilePreview() {
  const { t } = useTranslation();
  const { formatTagLabel, formatProjectType } = useAppFormatters();
  const profile = demoContractorProfilePreview;

  return (
    <ProductPreviewFrame>
      <div className="card product-preview-profile">
        <h3 className="section-title">{profile.companyName}</h3>
        <div className="meta-grid product-preview-profile-meta">
          <div>
            <span className="muted">{t('contractor.verification')}</span>
            <span className="status-pill">{t('verificationStatus.verified')}</span>
          </div>
          <div>
            <span className="muted">{t('contractor.specialtiesLegend')}</span>
            <div className="product-preview-tag-row">
              {profile.tagSlugs.map((slug) => (
                <span key={slug} className="tag-pill">
                  {formatTagLabel(slug, slug)}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="muted">{t('contractor.projectTypesLegend')}</span>
            <strong>
              {profile.projectTypes
                .map((type) => formatProjectType(type))
                .join(', ')}
            </strong>
          </div>
          <div>
            <span className="muted">{t('verification.yourDocuments')}</span>
            <strong>{profile.documentsCount}</strong>
          </div>
        </div>
      </div>
    </ProductPreviewFrame>
  );
}

export function ContractorDiscoverPreview() {
  const { marketplaceTiles } = useLocalizedDemoContent();

  return (
    <ProductPreviewFrame>
      <div className="product-preview-tile-grid">
        {marketplaceTiles.map((project) => (
          <div key={project.id} className="product-preview-tile-wrap">
            <ProjectTile project={project} />
          </div>
        ))}
      </div>
    </ProductPreviewFrame>
  );
}

export function ContractorProjectPreview() {
  const { project, brief, tags } = useLocalizedDemoContent();

  return (
    <ProductPreviewFrame>
      <div className="product-preview-hero-layout product-preview-hero-layout--contractor">
        <div className="product-preview-hero-main">
          <h3 className="product-preview-project-title">{project.title}</h3>
          <p className="muted product-preview-project-desc">{project.description}</p>
          <ProjectBriefCard brief={brief} compact />
        </div>
        <ProjectHeroSidebar
          project={project}
          estimateMidAmountThb={project.estimate?.totals.midAmount}
          tags={tags}
          showTags
        />
      </div>
    </ProductPreviewFrame>
  );
}

export function ContractorClarifyPreview() {
  const { t } = useTranslation();
  const { questions } = useLocalizedDemoContent();

  return (
    <ProductPreviewFrame>
      <div className="structured-clarification product-preview-structured-clarification">
        <h3 className="tender-subsection-title">{t('contractor.yourQuestionList')}</h3>
        <p className="muted">{t('clarification.composeDisclaimer')}</p>
        <ul className="product-preview-question-form">
          {questions.slice(0, 2).map((q, index) => (
            <li key={q.id} className="card product-preview-question-field">
              <label>
                <span className="product-preview-field-label">
                  {index + 1}. {q.questionText}
                </span>
                <span className="product-preview-field-value muted">
                  {t('clarification.questionPlaceholder')}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </ProductPreviewFrame>
  );
}

export function ContractorProposalPreview() {
  const { bids, project } = useLocalizedDemoContent();

  return (
    <ProductPreviewFrame>
      <div className="card bid-application-card product-preview-proposal">
        <BidProposalSummary
          bid={bids[0]}
          ballparkMid={project.estimate?.totals.midAmount}
          detailsOnly
        />
      </div>
    </ProductPreviewFrame>
  );
}

export function ContractorTrackPreview() {
  const { t } = useTranslation();

  const statuses = [
    { bidStatus: 'enrolled' as const, label: t('explainer.contractors.track.enrolled') },
    { bidStatus: 'clarifying' as const, label: t('explainer.contractors.track.clarifying') },
    { bidStatus: 'submitted' as const, label: t('explainer.contractors.track.submitted') },
    { bidStatus: 'selected' as const, label: t('explainer.contractors.track.selected') },
  ];

  return (
    <div className="product-tour-flow product-tour-flow--horizontal product-tour-flow--status">
      {statuses.map((item, index) => (
        <div key={item.bidStatus} className="product-tour-flow-step">
          <span
            className={`product-tour-flow-node${index === 2 ? ' product-tour-flow-node--active' : ''}`}
          >
            {index + 1}
          </span>
          <span className="product-tour-flow-label">{item.label}</span>
          {index < statuses.length - 1 && (
            <span className="product-tour-flow-arrow" aria-hidden>
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function ContractorApplicationsPreview() {
  const { applications } = useLocalizedDemoContent();

  return (
    <ProductPreviewFrame>
      <div className="product-preview-stack">
        {applications.map((app) => (
          <div key={app.bidId} className="product-preview-tile-wrap">
            <ContractorApplicationTile application={app} />
          </div>
        ))}
      </div>
    </ProductPreviewFrame>
  );
}

export function ContractorSignPreview() {
  return (
    <ProductPreviewFrame>
      <div className="card contract-signing-panel product-preview-signing">
        <ContractSigningStatusPill contract={demoContractFullySigned} />
        <ContractSigningPartiesInline contract={demoContractFullySigned} />
      </div>
    </ProductPreviewFrame>
  );
}

export function ContractorSignFlowPreview({
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
