'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { useSession } from '@/components/SessionProvider';
import { isDesignerUser, isSupplySideUser } from '@/lib/session';
import {
  fetchContractorProfile,
  type ContractorProfile,
} from '@/lib/tendering';

type BannerPhase = 'no_profile' | 'rejected' | 'info';

function resolvePhase(profile: ContractorProfile | null): BannerPhase {
  if (!profile) return 'no_profile';
  if (profile.verificationStatus === 'rejected') return 'rejected';
  // When urgent verification messages are not shown, surface the notify tip.
  return 'info';
}

function dismissStorageKey(userId: string, phase: BannerPhase): string {
  return `builthai:home-verification-banner:${userId}:${phase}`;
}

function isDismissed(userId: string, phase: BannerPhase): boolean {
  try {
    return sessionStorage.getItem(dismissStorageKey(userId, phase)) === '1';
  } catch {
    return false;
  }
}

function persistDismiss(userId: string, phase: BannerPhase): void {
  try {
    sessionStorage.setItem(dismissStorageKey(userId, phase), '1');
  } catch {
    // Private mode / blocked storage — still hide in-memory for this mount.
  }
}

/**
 * Home-only reminder for contractors/designers: urgent verification prompts,
 * or (when those are not needed) a tip that registered supply is notified
 * when clients publish clarification / open tenders.
 */
export function SupplyVerificationBanner() {
  const { t } = useTranslation();
  const { me, ready } = useSession();
  const [profile, setProfile] = useState<ContractorProfile | null | undefined>(
    undefined,
  );
  const [dismissed, setDismissed] = useState(false);

  const isDesigner = isDesignerUser(me);
  const portalHref = isDesigner ? '/designer' : '/contractor';

  const loadProfile = useCallback(async () => {
    if (!ready || !me || !isSupplySideUser(me)) {
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
  }, [loadProfile]);

  useEffect(() => {
    const onFocus = () => {
      void loadProfile();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadProfile]);

  useEffect(() => {
    setDismissed(false);
  }, [me?.id]);

  if (!ready || !me) {
    return null;
  }

  const isSupply = isSupplySideUser(me);
  // Clients (and other non-supply users): always show the notify tip.
  // Supply: urgent verification first; otherwise the same notify tip.
  let phase: BannerPhase | null = null;
  if (isSupply) {
    if (profile === undefined) return null;
    phase = resolvePhase(profile);
  } else {
    phase = 'info';
  }

  if (!phase) {
    return null;
  }

  if (dismissed || isDismissed(me.id, phase)) {
    return null;
  }

  const titleKey =
    phase === 'no_profile'
      ? 'verification.bannerNoProfileTitle'
      : phase === 'rejected'
        ? 'verification.bannerRejectedTitle'
        : 'verification.bannerNotifyTitle';
  const bodyKey =
    phase === 'no_profile'
      ? 'verification.bannerNoProfileBody'
      : phase === 'rejected'
        ? 'verification.bannerRejectedBody'
        : 'verification.bannerNotifyBody';
  const ctaKey =
    phase === 'no_profile'
      ? 'verification.bannerCreateProfile'
      : phase === 'rejected'
        ? 'verification.bannerCompleteVerification'
        : null;

  const handleDismiss = () => {
    persistDismiss(me.id, phase);
    setDismissed(true);
  };

  return (
    <aside
      className={`home-verification-banner home-verification-banner--${phase}`}
      role="status"
      aria-live="polite"
    >
      <div className="home-verification-banner-inner">
        <span className="home-verification-banner-icon" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {phase === 'rejected' ? (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5" />
                <path d="M12 16h.01" />
              </>
            ) : phase === 'info' ? (
              <>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </>
            ) : (
              <>
                <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
                <path d="M9.5 12.5l1.8 1.8 3.7-3.8" />
              </>
            )}
          </svg>
        </span>

        <div className="home-verification-banner-copy">
          <strong className="home-verification-banner-title">
            {t(titleKey)}
          </strong>
          <p className="home-verification-banner-text">{t(bodyKey)}</p>
        </div>

        <div className="home-verification-banner-actions">
          {ctaKey ? (
            <Link href={portalHref} className="primary home-verification-banner-cta">
              {t(ctaKey)}
            </Link>
          ) : null}
          <button
            type="button"
            className="home-verification-banner-dismiss"
            onClick={handleDismiss}
            aria-label={t('verification.bannerDismiss')}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
