'use client';

import { useState } from 'react';
import { HelpHub } from '@/components/help/HelpHub';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';

export function HelpPageClient() {
  const { me, signOut, refreshSession } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />
      <main className="content-container main-content">
        <HelpHub />
      </main>
      {/* The footer comes from PageShell — rendering it here duplicated it. */}
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
