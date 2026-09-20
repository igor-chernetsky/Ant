import { CANONICAL_APP_ORIGIN } from '@/lib/app-base-url';

/** Placeholder platform identity until production entity/domain are final. */
export const LEGAL_PLATFORM_NAME = 'BuilTHAI';
/**
 * Public offer documents name the platform URL, so it must stay on the
 * canonical production host — a preview deployment must never appear here.
 */
export const LEGAL_PLATFORM_URL = `${CANONICAL_APP_ORIGIN}/`;
/** Contact / ops email used in legal docs; keep in sync with PLATFORM_ADMIN_EMAIL on the API. */
export const LEGAL_CONTACT_EMAIL = 'hello@builthai.com';
