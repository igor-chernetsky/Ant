/**
 * Landing context for the acquisition funnel.
 *
 * GA4 already receives `utm_*` through the page URL, but the product events
 * (CTA click, estimate started) must be joinable with the campaign. This module
 * keeps a first-touch context for the current browser session and turns it into
 * event params.
 *
 * No PII: only campaign parameters, the landing path and the referrer host.
 */

export const LANDING_CONTEXT_KEY = 'ant_landing_ctx';

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

export interface LandingContext {
  /** Path (with query) of the first page of this session, e.g. `/?create=1`. */
  landingPath: string;
  /** Pathname only, e.g. `/`, `/start`, `/projects/<id>`. */
  entry: string;
  /** True when the landing URL carried `?create=1` (the ad deep link). */
  hasCreateParam: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrerHost?: string;
}

const MAX_PARAM_LENGTH = 120;

function clean(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_PARAM_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

function hostOf(referrer: string): string | undefined {
  if (!referrer) {
    return undefined;
  }
  try {
    // Group campaign referrers without the `www.` noise: facebook.com, google.com.
    return clean(new URL(referrer).host.replace(/^www\./i, ''));
  } catch {
    return undefined;
  }
}

export interface LandingInput {
  /** `window.location.search`, e.g. `?utm_source=facebook&create=1`. */
  search: string;
  /** `window.location.pathname`. */
  pathname: string;
  /** `document.referrer`. */
  referrer: string;
  /** The site's own host, to drop self-referrals from internal navigation. */
  selfHost?: string;
}

/** Build the context from a landing URL. Pure: no browser access. */
export function readLandingContext(input: LandingInput): LandingContext {
  const params = new URLSearchParams(
    input.search.startsWith('?') ? input.search.slice(1) : input.search,
  );

  const context: LandingContext = {
    landingPath: `${input.pathname || '/'}${input.search || ''}`,
    entry: input.pathname || '/',
    hasCreateParam: params.get('create') === '1',
  };

  for (const key of UTM_KEYS) {
    const value = clean(params.get(key));
    if (!value) {
      continue;
    }
    const field = `utm${key
      .replace('utm_', '')
      .replace(/^\w/, (char) => char.toUpperCase())}` as
      | 'utmSource'
      | 'utmMedium'
      | 'utmCampaign'
      | 'utmContent'
      | 'utmTerm';
    context[field] = value;
  }

  const referrerHost = hostOf(input.referrer);
  const selfHost = clean(input.selfHost?.replace(/^www\./i, ''));
  if (referrerHost && referrerHost !== selfHost) {
    context.referrerHost = referrerHost;
  }

  return context;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Persist the first landing context of the session. Later calls are ignored. */
export function persistLandingContext(
  context: LandingContext,
  storage: StorageLike | null = defaultStorage(),
): LandingContext {
  if (!storage) {
    return context;
  }
  try {
    const existing = storage.getItem(LANDING_CONTEXT_KEY);
    if (existing) {
      const parsed = JSON.parse(existing) as LandingContext;
      if (parsed && typeof parsed === 'object' && parsed.landingPath) {
        return parsed;
      }
    }
    storage.setItem(LANDING_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // Storage can be blocked (private mode) — the event still fires without it.
  }
  return context;
}

export function loadLandingContext(
  storage: StorageLike | null = defaultStorage(),
): LandingContext | null {
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(LANDING_CONTEXT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as LandingContext;
    return parsed && typeof parsed === 'object' && parsed.landingPath
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/** Event params derived from the landing context (undefined keys are dropped). */
export function landingEventParams(
  context: LandingContext | null,
): Record<string, string | boolean> {
  if (!context) {
    return {};
  }
  const params: Record<string, string | boolean> = {
    entry: context.entry,
    landing_path: context.landingPath,
    has_create_param: context.hasCreateParam,
  };
  if (context.utmSource) params.utm_source = context.utmSource;
  if (context.utmMedium) params.utm_medium = context.utmMedium;
  if (context.utmCampaign) params.utm_campaign = context.utmCampaign;
  if (context.utmContent) params.utm_content = context.utmContent;
  if (context.utmTerm) params.utm_term = context.utmTerm;
  if (context.referrerHost) params.referrer_host = context.referrerHost;
  return params;
}
