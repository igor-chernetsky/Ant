'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { HeaderNotifications } from '@/components/HeaderNotifications';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from '@/components/LocaleProvider';
import { headerUserLabel, type MeResponse } from '@/lib/session';

interface SiteHeaderProps {
  me: MeResponse | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

function HeaderAccountMenu({
  me,
  onSignOut,
}: {
  me: MeResponse;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const label = headerUserLabel(me, t('header.signedIn'));

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="header-account" ref={rootRef}>
      <button
        type="button"
        className="header-account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="header-account-avatar" aria-hidden>
          {label.slice(0, 1).toUpperCase()}
        </span>
        <span className="header-account-name">{label}</span>
        <span className="header-account-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div id={menuId} className="header-account-menu" role="menu">
          <Link
            href="/account"
            role="menuitem"
            className="header-account-menu-item"
            onClick={() => setOpen(false)}
          >
            {t('header.account')}
          </Link>
          <button
            type="button"
            role="menuitem"
            className="header-account-menu-item header-account-menu-item-danger"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            {t('header.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

export function SiteHeader({
  me,
  onSignIn,
  onSignOut,
}: SiteHeaderProps) {
  const { t } = useTranslation();
  const isAdmin = Boolean(me?.roles?.includes('admin'));
  const isContractor = Boolean(
    me?.isContractor || me?.roles?.includes('contractor'),
  );

  return (
    <header className="site-header">
      <div className="content-container site-header-inner">
        <div className="header-brand-nav">
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

          <nav className="header-nav" aria-label={t('header.primaryNav')}>
            <Link href="/" className="header-nav-link">
              {t('header.projects')}
            </Link>
            <Link href="/materials" className="header-nav-link">
              {t('header.materials')}
            </Link>
            {isContractor && (
              <Link href="/contractor" className="header-nav-link">
                {t('header.contractor')}
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin/contractors" className="header-nav-link">
                {t('header.admin')}
              </Link>
            )}
          </nav>
        </div>

        <div className="header-utilities">
          <LanguageSwitcher />
          {me ? (
            <>
              <HeaderNotifications />
              <span className="header-utilities-divider" aria-hidden />
              <HeaderAccountMenu me={me} onSignOut={onSignOut} />
            </>
          ) : (
            <>
              <span className="header-utilities-divider" aria-hidden />
              <button
                type="button"
                className="header-sign-in"
                onClick={onSignIn}
              >
                {t('header.signIn')}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
