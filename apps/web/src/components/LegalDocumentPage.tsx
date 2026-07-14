'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import type { LegalDocument } from '@/lib/legal';

interface LegalDocumentPageProps {
  document: LegalDocument;
  breadcrumbKey: 'privacyPolicy' | 'termsOfService';
}

export function LegalDocumentPage({
  document,
  breadcrumbKey,
}: LegalDocumentPageProps) {
  const { t } = useTranslation();
  const { me, refreshSession, signOut } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />

      <main className="content-container main-content legal-page">
        <header className="legal-page-header">
          <p className="legal-page-kicker">
            <Link href="/" className="project-hero-back-link">
              {t('common.home')}
            </Link>
            <span className="project-hero-kicker-sep" aria-hidden>
              /
            </span>
            <span>{t(`footer.${breadcrumbKey}`)}</span>
          </p>
          <h1 className="legal-page-title">{document.title}</h1>
          <p className="muted legal-page-updated">{document.updatedLabel}</p>
        </header>

        <article className="legal-document card">
          <p className="legal-document-intro">{document.intro}</p>
          {document.sections.map((section) => (
            <section key={section.title} className="legal-document-section">
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.title}-${index}`}>{paragraph}</p>
              ))}
            </section>
          ))}
        </article>
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          setLoginOpen(false);
          void refreshSession();
        }}
      />
    </PageShell>
  );
}
