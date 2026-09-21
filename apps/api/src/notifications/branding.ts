/**
 * Public branding constants used in outbound email.
 *
 * Kept next to the notification layer because the API cannot import web
 * constants. Keep the URLs in sync with `apps/web/src/lib/social-links.ts` and
 * publish clean profile URLs only (no share/tracking parameters).
 */
export const PLATFORM_SOCIAL_LINKS = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61593503415341',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/builthai',
  },
] as const;
