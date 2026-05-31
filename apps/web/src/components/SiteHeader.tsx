'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { MeResponse } from '@/lib/session';

interface SiteHeaderProps {
  me: MeResponse | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onAddProject?: () => void;
}

export function SiteHeader({
  me,
  onSignIn,
  onSignOut,
  onAddProject,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="content-container site-header-inner">
        <div className="header-left">
          <Link href="/" className="brand">
            <Image
              src="/ant-logo.png"
              alt=""
              width={36}
              height={36}
              className="brand-logo"
              priority
            />
            <span className="brand-text">Ant</span>
          </Link>
        </div>
        <div className="header-actions">
          {onAddProject && (
            <button type="button" className="primary" onClick={onAddProject}>
              Add project
            </button>
          )}
          {me ? (
            <>
              {me.roles?.includes('admin') && (
                <Link href="/admin/contractors" className="text-link header-link">
                  Admin
                </Link>
              )}
              <Link href="/contractor" className="text-link header-link">
                Contractor
              </Link>
              <span className="user-chip">
                {me.displayName ?? me.email ?? 'Signed in'}
              </span>
              <button type="button" className="secondary" onClick={onSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <button type="button" className="secondary" onClick={onSignIn}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
