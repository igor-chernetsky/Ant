'use client';

import { useMemo, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import {
  ExplainerBenefits,
  ExplainerCta,
  ExplainerFaq,
  ExplainerHero,
  ExplainerMockup,
  ExplainerSteps,
  type ExplainerBenefitItem,
  type ExplainerFaqItem,
  type ExplainerStepItem,
} from '@/components/explainer/ExplainerSections';

type Audience = 'clients' | 'contractors';

function itemsFromKeys<T>(
  count: number,
  map: (index: number) => T,
): T[] {
  return Array.from({ length: count }, (_, index) => map(index + 1));
}

export function ExplainerLandingPage({ audience }: { audience: Audience }) {
  const { t } = useTranslation();
  const { me, refreshSession, signOut } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);
  const base = `explainer.${audience}`;
  const primaryHref = audience === 'clients' ? '/' : '/contractor';
  const secondaryHref = '/help';

  const steps = useMemo(
    () =>
      itemsFromKeys<ExplainerStepItem>(4, (index) => ({
        title: t(`${base}.steps.step${index}Title`),
        body: t(`${base}.steps.step${index}Body`),
      })),
    [base, t],
  );

  const benefits = useMemo(
    () =>
      itemsFromKeys<ExplainerBenefitItem>(4, (index) => ({
        title: t(`${base}.benefits.item${index}Title`),
        body: t(`${base}.benefits.item${index}Body`),
      })),
    [base, t],
  );

  const faq = useMemo(
    () =>
      itemsFromKeys<ExplainerFaqItem>(3, (index) => ({
        question: t(`${base}.faq.item${index}Question`),
        answer: t(`${base}.faq.item${index}Answer`),
      })),
    [base, t],
  );

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />
      <main className="content-container main-content explainer-page">
        <ExplainerHero
          kicker={t(`${base}.heroKicker`)}
          title={t(`${base}.heroTitle`)}
          lead={t(`${base}.heroLead`)}
          primaryLabel={t(`${base}.heroPrimaryCta`)}
          primaryHref={primaryHref}
          secondaryLabel={t(`${base}.heroSecondaryCta`)}
          secondaryHref={secondaryHref}
          mockup={
            <ExplainerMockup
              audience={audience}
              eyebrow={t(`${base}.mockupEyebrow`)}
              headline={t(`${base}.mockupHeadline`)}
              detail={t(`${base}.mockupDetail`)}
              metricTitle={t(`${base}.mockupMetricTitle`)}
              metricBody={t(`${base}.mockupMetricBody`)}
              pills={[
                t(`${base}.mockupPill1`),
                t(`${base}.mockupPill2`),
                t(`${base}.mockupPill3`),
                t(`${base}.mockupPill4`),
              ]}
            />
          }
        />

        <ExplainerSteps
          title={t(`${base}.stepsTitle`)}
          lead={t(`${base}.stepsLead`)}
          items={steps}
        />

        <ExplainerBenefits
          title={t(`${base}.benefitsTitle`)}
          lead={t(`${base}.benefitsLead`)}
          items={benefits}
        />

        <ExplainerFaq
          title={t(`${base}.faqTitle`)}
          lead={t(`${base}.faqLead`)}
          items={faq}
        />

        <ExplainerCta
          title={t(`${base}.finalTitle`)}
          body={t(`${base}.finalBody`)}
          primaryLabel={t(`${base}.finalPrimaryCta`)}
          primaryHref={primaryHref}
          secondaryLabel={t(`${base}.finalSecondaryCta`)}
          secondaryHref={secondaryHref}
        />
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
