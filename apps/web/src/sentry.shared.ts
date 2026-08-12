import type * as Sentry from '@sentry/nextjs';

/** DSN for browser + Next.js server/edge. Set NEXT_PUBLIC_SENTRY_DSN on Vercel. */
export function webSentryDsn(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    process.env.SENTRY_DSN?.trim() ||
    undefined
  );
}

export function webSentryEnvironment(): string {
  return (
    process.env.SENTRY_ENVIRONMENT?.trim() ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    'development'
  );
}

export function webTracesSampleRate(): number {
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
  }
  return process.env.NODE_ENV === 'production' ? 0.1 : 1;
}

/** Shared Sentry.init options for client, server, and edge. */
export function webSentryInitOptions(): Parameters<
  typeof Sentry.init
>[0] {
  const dsn = webSentryDsn();
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: webSentryEnvironment(),
    tracesSampleRate: webTracesSampleRate(),
    enableLogs: process.env.NODE_ENV === 'production',
    dataCollection: {
      // userInfo: false,
      // httpBodies: [],
    },
  };
}
