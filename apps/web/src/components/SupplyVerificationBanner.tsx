'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { useSession } from '@/components/SessionProvider';
import { isDesignerUser, isSupplySideUser } from '@/lib/session';
import {
  fetchContractorProfile,
  type ContractorProfile,
} from '@/lib/tendering';

type BannerPhase =
  | 'no_profile'
  | 'pending'
  | 'rejected'
  | 'awaiting_review';

function resolvePhase(
  profile: ContractorProfile | null,
): BannerPhase | null {
  if (!profile) return 'no_profile';
  switch (profile.verificationStatus) {
    case 'verified':
      return null;
    case 'awaiting_review':
      return 'awaiting_review';
    case 'rejected':
      return 'rejected';
    case 'pending':
    default:
      return 'pending';
  }
}

/**
 * Persistent reminder for contractors/designers until admin verification.
 * Shown on every page while supply-side onboarding is incomplete.
 */
export function SupplyVerificationBanner() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { me, ready } = useSession();
  const [profile, setProfile] = useState<ContractorProfile | null | undefined>(
    undefined,
  );

  const isDesigner = isDesignerUser(me);
  const portalHref = isDesigner ? '/designer' : '/contractor';

  const loadProfile = useCallback(async () => {
    if (!ready || !isSupplySideUser(me)) {
      setProfile(undefined);
      return;
    }
    try {
      const next = await fetchContractorProfile();
      setProfile(next);
    } catch {
      setProfile(null);
    }
  }, [ready, me]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile, pathname]);

  useEffect(() => {
    const onFocus = () => {
      void loadProfile();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadProfile]);

  if (!ready || !isSupplySideUser(me) || profile === undefined) {
    return null;
  }

  const phase = resolvePhase(profile);
  if (!phase) {
    return null;
  }

  const titleKey =
    phase === 'no_profile'
      ? 'verification.bannerNoProfileTitle'
      : phase === 'pending'
        ? 'verification.bannerPendingTitle'
        : phase === 'rejected'
          ? 'verification.bannerRejectedTitle'
          : 'verification.bannerAwaitingTitle';

  const bodyKey =
    phase === 'no_profile'
      ? 'verification.bannerNoProfileBody'
      : phase === 'pending'
        ? 'verification.bannerPendingBody'
        : phase === 'rejected'
          ? 'verification.bannerRejectedBody'
          : 'verification.bannerAwaitingBody';

  const ctaKey =
    phase === 'awaiting_review'
      ? 'verification.bannerOpenPortal'
      : phase === 'no_profile'
        ? 'verification.bannerCreateProfile'
        : 'verification.bannerCompleteVerification';

  const onPortalPage =
    pathname === portalHref || pathname.startsWith(`${portalHref}/`);

  return (
    <aside
      className={`supply-verification-banner supply-verification-banner--${phase}`}
      role="status"
      aria-live="polite"
    >
      <div className="supply-verification-banner-inner content-container">
        <div className="supply-verification-banner-copy">
          <strong className="supply-verification-banner-title">
            {t(titleKey)}
          </strong>
          <p className="supply-verification-banner-text">{t(bodyKey)}</p>
        </div>
        {!onPortalPage && (
          <Link href={portalHref} className="primary supply-verification-banner-cta">
            {t(ctaKey)}
          </Link>
        )}
      </div>
    </aside>
  );
}
