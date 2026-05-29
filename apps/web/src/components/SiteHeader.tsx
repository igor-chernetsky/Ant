'use client';

import Link from 'next/link';
import type { MeResponse } from '@/lib/session';

interface SiteHeaderProps {
  me: MeResponse | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function SiteHeader({ me, onSignIn, onSignOut }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="header-left">
        <Link href="/" className="brand">
          Construction Marketplace
        </Link>
        <nav className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/projects">Projects</Link>
        </nav>
      </div>
      <div className="row">
        {me ? (
          <>
            <span className="user-chip">
              {me.displayName ?? me.email ?? 'Signed in'}
            </span>
            <button type="button" className="secondary" onClick={onSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <button type="button" className="primary" onClick={onSignIn}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
