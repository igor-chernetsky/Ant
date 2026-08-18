'use client';

import { useMemo, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import {
  ProductTourCta,
  ProductTourDifferentiators,
  ProductTourFaq,
  ProductTourHero,
  ProductTourSection,
  ProductTourWorkflowNav,
  useProductTourLayout,
  useWorkflowScrollSpy,
  type TourDifferentiatorItem,
  type TourFaqItem,
  type TourWorkflowStep,
} from '@/components/explainer/ProductTourSections';
import {
  ClientAnalyzePreview,
  ClientClarifyPreview,
  ClientComparePreview,
  ClientCreatePreview,
  ClientEstimatePreview,
  ClientHeroPreview,
  ClientSignFlowPreview,
  ClientSignPreview,
  ClientTenderPreview,
} from '@/components/marketing/ClientProductPreviews';
import {
  ContractorApplicationsPreview,
  ContractorClarifyPreview,
  ContractorDiscoverPreview,
  ContractorHeroPreview,
  ContractorProfilePreview,
  ContractorProjectPreview,
  ContractorProposalPreview,
  ContractorSignFlowPreview,
  ContractorSignPreview,
  ContractorTrackPreview,
} from '@/components/marketing/ContractorProductPreviews';

type Audience = 'clients' | 'contractors';

const CLIENT_SECTION_IDS = [
  'step-create',
  'step-analyze',
  'step-clarify',
  'step-estimate',
  'step-tender',
  'step-compare',
  'step-sign',
] as const;

const CONTRACTOR_SECTION_IDS = [
  'step-profile',
  'step-discover',
  'step-review',
  'step-clarify',
  'step-proposal',
  'step-track',
  'step-sign',
] as const;

function itemsFromKeys<T>(
  count: number,
  map: (index: number) => T,
): T[] {
  return Array.from({ length: count }, (_, index) => map(index + 1));
}

function ClientTourPage({ base }: { base: string }) {
  const { t } = useTranslation();
  const { activeId, scrollTo } = useWorkflowScrollSpy(CLIENT_SECTION_IDS);

  const workflowSteps = useMemo<TourWorkflowStep[]>(
    () =>
      itemsFromKeys(7, (index) => ({
        id: CLIENT_SECTION_IDS[index - 1],
        number: String(index).padStart(2, '0'),
        label: t(`${base}.workflow.step${index}`),
      })),
    [base, t],
  );

  const differentiators = useMemo<TourDifferentiatorItem[]>(
    () =>
      itemsFromKeys(5, (index) => ({
        title: t(`${base}.why.item${index}Title`),
        body: t(`${base}.why.item${index}Body`),
      })),
    [base, t],
  );

  const faq = useMemo<TourFaqItem[]>(
    () =>
      itemsFromKeys(6, (index) => ({
        question: t(`${base}.faq.item${index}Question`),
        answer: t(`${base}.faq.item${index}Answer`),
      })),
    [base, t],
  );

  const signFlowSteps = useMemo(
    () => itemsFromKeys(4, (index) => t(`${base}.sections.signFlow${index}`)),
    [base, t],
  );

  const sectionConfigs = useMemo(
    () => [
      {
        id: 'step-create',
        key: 'create',
        reverse: false,
        preview: <ClientCreatePreview />,
      },
      {
        id: 'step-analyze',
        key: 'analyze',
        reverse: true,
        band: true,
        preview: <ClientAnalyzePreview />,
      },
      {
        id: 'step-clarify',
        key: 'clarify',
        reverse: false,
        note: true,
        preview: <ClientClarifyPreview />,
      },
      {
        id: 'step-estimate',
        key: 'estimate',
        reverse: true,
        note: true,
        band: true,
        preview: <ClientEstimatePreview />,
      },
      {
        id: 'step-tender',
        key: 'tender',
        reverse: false,
        preview: <ClientTenderPreview />,
      },
      {
        id: 'step-compare',
        key: 'compare',
        reverse: true,
        band: true,
        preview: <ClientComparePreview />,
      },
      {
        id: 'step-sign',
        key: 'sign',
        reverse: false,
        preview: (
          <div className="product-tour-sign-layout">
            <ClientSignFlowPreview steps={signFlowSteps} />
            <ClientSignPreview />
          </div>
        ),
      },
    ],
    [signFlowSteps],
  );

  return (
    <>
      <ProductTourWorkflowNav
        steps={workflowSteps}
        activeId={activeId}
        onSelect={scrollTo}
        ariaLabel={t('explainer.workflowNavAria')}
      />

      <ProductTourHero
        kicker={t(`${base}.heroKicker`)}
        title={t(`${base}.heroTitle`)}
        lead={t(`${base}.heroLead`)}
        primaryLabel={t(`${base}.heroPrimaryCta`)}
        primaryHref="/"
        secondaryLabel={t(`${base}.heroSecondaryCta`)}
        secondaryHref="#step-create"
        visual={
          <ClientHeroPreview
            callouts={{
              scope: t(`${base}.callouts.scope`),
              estimate: t(`${base}.callouts.estimate`),
              tender: t(`${base}.callouts.tender`),
            }}
          />
        }
      />

      {sectionConfigs.map((section) => (
          <ProductTourSection
            key={section.id}
            id={section.id}
            title={t(`${base}.sections.${section.key}Title`)}
            body={t(`${base}.sections.${section.key}Body`)}
            note={
              section.note
                ? t(`${base}.sections.${section.key}Note`)
                : undefined
            }
            preview={section.preview}
            reverse={section.reverse}
            band={section.band}
          />
        ))}

      <ProductTourDifferentiators
        title={t(`${base}.whyTitle`)}
        items={differentiators}
      />

      <ProductTourFaq title={t(`${base}.faqTitle`)} items={faq} />

      <ProductTourCta
        title={t(`${base}.finalTitle`)}
        primaryLabel={t(`${base}.finalPrimaryCta`)}
        primaryHref="/"
        secondaryLabel={t(`${base}.finalSecondaryCta`)}
        secondaryHref="/"
      />
    </>
  );
}

function ContractorTourPage({ base }: { base: string }) {
  const { t } = useTranslation();
  const { activeId, scrollTo } = useWorkflowScrollSpy(CONTRACTOR_SECTION_IDS);

  const workflowSteps = useMemo<TourWorkflowStep[]>(
    () =>
      itemsFromKeys(7, (index) => ({
        id: CONTRACTOR_SECTION_IDS[index - 1],
        number: String(index).padStart(2, '0'),
        label: t(`${base}.workflow.step${index}`),
      })),
    [base, t],
  );

  const differentiators = useMemo<TourDifferentiatorItem[]>(
    () =>
      itemsFromKeys(5, (index) => ({
        title: t(`${base}.why.item${index}Title`),
        body: t(`${base}.why.item${index}Body`),
      })),
    [base, t],
  );

  const faq = useMemo<TourFaqItem[]>(
    () =>
      itemsFromKeys(6, (index) => ({
        question: t(`${base}.faq.item${index}Question`),
        answer: t(`${base}.faq.item${index}Answer`),
      })),
    [base, t],
  );

  const signFlowSteps = useMemo(
    () => itemsFromKeys(3, (index) => t(`${base}.sections.signFlow${index}`)),
    [base, t],
  );

  const contractorSections = useMemo(
    () => [
      { id: 'step-profile', key: 'profile', reverse: false, preview: <ContractorProfilePreview /> },
      { id: 'step-discover', key: 'discover', reverse: true, band: true, preview: <ContractorDiscoverPreview /> },
      { id: 'step-review', key: 'review', reverse: false, preview: <ContractorProjectPreview /> },
      { id: 'step-clarify', key: 'clarify', reverse: true, note: true, band: true, preview: <ContractorClarifyPreview /> },
      { id: 'step-proposal', key: 'proposal', reverse: false, preview: <ContractorProposalPreview /> },
      {
        id: 'step-track',
        key: 'track',
        reverse: true,
        band: true,
        preview: (
          <div className="product-tour-track-layout">
            <ContractorTrackPreview />
            <ContractorApplicationsPreview />
          </div>
        ),
      },
      {
        id: 'step-sign',
        key: 'sign',
        reverse: false,
        preview: (
          <div className="product-tour-sign-layout">
            <ContractorSignFlowPreview steps={signFlowSteps} />
            <ContractorSignPreview />
          </div>
        ),
      },
    ],
    [signFlowSteps],
  );

  return (
    <>
      <ProductTourWorkflowNav
        steps={workflowSteps}
        activeId={activeId}
        onSelect={scrollTo}
        ariaLabel={t('explainer.workflowNavAria')}
      />

      <ProductTourHero
        kicker={t(`${base}.heroKicker`)}
        title={t(`${base}.heroTitle`)}
        lead={t(`${base}.heroLead`)}
        primaryLabel={t(`${base}.heroPrimaryCta`)}
        primaryHref="/contractor"
        secondaryLabel={t(`${base}.heroSecondaryCta`)}
        secondaryHref="/"
        visual={<ContractorHeroPreview />}
      />

      {contractorSections.map((section) => (
          <ProductTourSection
            key={section.id}
            id={section.id}
            title={t(`${base}.sections.${section.key}Title`)}
            body={t(`${base}.sections.${section.key}Body`)}
            note={
              section.note
                ? t(`${base}.sections.${section.key}Note`)
                : undefined
            }
            preview={section.preview}
            reverse={section.reverse}
            band={section.band}
          />
        ))}

      <ProductTourDifferentiators
        title={t(`${base}.whyTitle`)}
        items={differentiators}
      />

      <ProductTourFaq title={t(`${base}.faqTitle`)} items={faq} />

      <ProductTourCta
        title={t(`${base}.finalTitle`)}
        primaryLabel={t(`${base}.finalPrimaryCta`)}
        primaryHref="/contractor"
        secondaryLabel={t(`${base}.finalSecondaryCta`)}
        secondaryHref="/"
      />
    </>
  );
}

export function ExplainerLandingPage({ audience }: { audience: Audience }) {
  const { me, refreshSession, signOut } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);
  const base = `explainer.${audience}`;
  useProductTourLayout();

  return (
    <PageShell className="page-shell--product-tour">
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />
      <main className="main-content product-tour-page">
        {audience === 'clients' ? (
          <ClientTourPage base={base} />
        ) : (
          <ContractorTourPage base={base} />
        )}
      </main>
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          void refreshSession();
        }}
      />
    </PageShell>
  );
}
