'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

function isHeaderNavActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return (
      pathname === '/' ||
      pathname === '/projects' ||
      pathname.startsWith('/projects/')
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function headerNavClass(pathname: string, href: string): string {
  return isHeaderNavActive(pathname, href)
    ? 'header-nav-link header-nav-link-active'
    : 'header-nav-link';
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
  const pathname = usePathname() || '/';
  const isAdmin = Boolean(me?.roles?.includes('admin'));
  const isContractor = Boolean(
    me?.isContractor || me?.roles?.includes('contractor'),
  );
  const isDesigner = Boolean(
    me?.isDesigner || me?.roles?.includes('designer'),
  );

  return (
    <header className="site-header">
      <div className="content-container site-header-inner">
        <div className="header-brand-nav">
          <Link href="/" className="brand" aria-label="BuilTHAI">
            <Image
              src="/logo.png"
              alt="BuilTHAI"
              width={121}
              height={36}
              className="brand-logo"
              priority
            />
          </Link>

          <nav className="header-nav" aria-label={t('header.primaryNav')}>
            <Link
              href="/"
              className={headerNavClass(pathname, '/')}
              aria-current={
                isHeaderNavActive(pathname, '/') ? 'page' : undefined
              }
            >
              {t('header.projects')}
            </Link>
            <Link
              href="/materials"
              className={headerNavClass(pathname, '/materials')}
              aria-current={
                isHeaderNavActive(pathname, '/materials')
                  ? 'page'
                  : undefined
              }
            >
              {t('header.materials')}
            </Link>
            <Link
              href="/help"
              className={headerNavClass(pathname, '/help')}
              aria-current={
                isHeaderNavActive(pathname, '/help') ? 'page' : undefined
              }
            >
              {t('header.help')}
            </Link>
            {isContractor && (
              <Link
                href="/contractor"
                className={headerNavClass(pathname, '/contractor')}
                aria-current={
                  isHeaderNavActive(pathname, '/contractor')
                    ? 'page'
                    : undefined
                }
              >
                {t('header.contractor')}
              </Link>
            )}
            {isDesigner && (
              <Link
                href="/designer"
                className={headerNavClass(pathname, '/designer')}
                aria-current={
                  isHeaderNavActive(pathname, '/designer')
                    ? 'page'
                    : undefined
                }
              >
                {t('header.designer')}
              </Link>
            )}
            {isAdmin && (
              <>
                <Link
                  href="/admin/contractors"
                  className={headerNavClass(pathname, '/admin/contractors')}
                  aria-current={
                    isHeaderNavActive(pathname, '/admin/contractors')
                      ? 'page'
                      : undefined
                  }
                >
                  {t('header.contractors')}
                </Link>
                <Link
                  href="/admin/directory"
                  className={headerNavClass(pathname, '/admin/directory')}
                  aria-current={
                    isHeaderNavActive(pathname, '/admin/directory')
                      ? 'page'
                      : undefined
                  }
                >
                  {t('header.supplyRegistry')}
                </Link>
                <Link
                  href="/admin/settings"
                  className={headerNavClass(pathname, '/admin/settings')}
                  aria-current={
                    isHeaderNavActive(pathname, '/admin/settings')
                      ? 'page'
                      : undefined
                  }
                >
                  {t('header.settings')}
                </Link>
              </>
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
