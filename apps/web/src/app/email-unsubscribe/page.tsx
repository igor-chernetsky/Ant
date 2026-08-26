'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';

type Status = 'loading' | 'ok' | 'error';

function EmailUnsubscribeContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get('token')?.trim() ?? '',
    [searchParams],
  );
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState(() => t('emailUnsubscribe.loading'));

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('emailUnsubscribe.missingToken'));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/email/unsubscribe?token=${encodeURIComponent(token)}`,
          { method: 'POST', cache: 'no-store' },
        );
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          ok?: boolean;
        };
        if (cancelled) return;
        if (!res.ok) {
          setStatus('error');
          setMessage(
            data.message?.trim() || t('emailUnsubscribe.expiredError'),
          );
          return;
        }
        setStatus('ok');
        setMessage(t('emailUnsubscribe.success'));
      } catch {
        if (cancelled) return;
        setStatus('error');
        setMessage(t('emailUnsubscribe.genericError'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const title =
    status === 'ok'
      ? t('emailUnsubscribe.titleOk')
      : status === 'error'
        ? t('emailUnsubscribe.titleError')
        : t('emailUnsubscribe.titleLoading');

  return (
    <PageShell>
      <main
        style={{
          maxWidth: 480,
          margin: '48px auto',
          padding: '0 16px',
        }}
      >
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 13,
            fontWeight: 700,
            color: '#2563eb',
            textTransform: 'uppercase',
          }}
        >
          {t('emailUnsubscribe.brand')}
        </p>
        <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>{title}</h1>
        <p style={{ margin: '0 0 24px', color: '#475569', lineHeight: 1.6 }}>
          {message}
        </p>
        <p style={{ margin: 0 }}>
          <Link href="/account" style={{ color: '#2563eb', fontWeight: 600 }}>
            {t('emailUnsubscribe.openAccount')}
          </Link>
          {' · '}
          <Link href="/" style={{ color: '#64748b' }}>
            {t('emailUnsubscribe.home')}
          </Link>
        </p>
      </main>
    </PageShell>
  );
}

export default function EmailUnsubscribePage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <main style={{ maxWidth: 480, margin: '48px auto', padding: '0 16px' }}>
            <EmailUnsubscribeFallback />
          </main>
        </PageShell>
      }
    >
      <EmailUnsubscribeContent />
    </Suspense>
  );
}

function EmailUnsubscribeFallback() {
  const { t } = useTranslation();
  return (
    <p style={{ color: '#475569' }}>{t('emailUnsubscribe.loading')}</p>
  );
}
