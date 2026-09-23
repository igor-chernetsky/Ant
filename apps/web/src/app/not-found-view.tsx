'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import { useTranslation } from '@/components/LocaleProvider';

/**
 * Branded 404. Rendered inside the root layout, so it inherits the site chrome,
 * the negotiated locale and the JSON-LD, and keeps the visitor one click away
 * from real content instead of dead-ending on the framework default page.
 *
 * The route itself still answers HTTP 404 (Next.js sets that for `not-found`),
 * so search engines keep treating these URLs as missing.
 */
export function NotFoundView() {
  const { t } = useTranslation();
  const { me, signOut } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <PageShell className="page-shell--not-found">
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main className="content-container main-content not-found-main">
        <section className="card not-found-card">
          <p className="not-found-code" aria-hidden>
            404
          </p>
          <h1 className="page-title">{t('notFound.title')}</h1>
          <p className="muted not-found-lead">{t('notFound.lead')}</p>

          <div className="not-found-actions">
            <Link href="/" className="primary">
              {t('notFound.browseProjects')}
            </Link>
            <Link href="/help" className="secondary">
              {t('notFound.help')}
            </Link>
            <Link href="/materials" className="secondary">
              {t('notFound.materials')}
            </Link>
          </div>

          <p className="muted not-found-hint">{t('notFound.hint')}</p>
        </section>
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => setLoginOpen(false)}
      />
    </PageShell>
  );
}
