'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from '@/components/LocaleProvider';
import { headerUserLabel, type MeResponse } from '@/lib/session';

interface SiteHeaderProps {
  me: MeResponse | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function SiteHeader({
  me,
  onSignIn,
  onSignOut,
}: SiteHeaderProps) {
  const { t } = useTranslation();

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
          <LanguageSwitcher />
          {me ? (
            <>
              {me.roles?.includes('admin') && (
                <Link href="/admin/contractors" className="text-link header-link">
                  {t('header.admin')}
                </Link>
              )}
              {(me.isContractor || me.roles?.includes('contractor')) && (
                <Link href="/contractor" className="text-link header-link">
                  {t('header.contractor')}
                </Link>
              )}
              <Link href="/account" className="text-link header-link">
                {t('header.account')}
              </Link>
              <span className="user-chip">
                {headerUserLabel(me, t('header.signedIn'))}
              </span>
              <button type="button" className="secondary" onClick={onSignOut}>
                {t('header.signOut')}
              </button>
            </>
          ) : (
            <button type="button" className="secondary" onClick={onSignIn}>
              {t('header.signIn')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
