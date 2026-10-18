export interface LinkLike {
  href: string | null;
  /** `target` attribute of the anchor, if any. */
  target?: string | null;
  download?: boolean;
}

const NON_NAVIGABLE_PREFIXES = ['#', 'mailto:', 'tel:', 'javascript:', 'data:'];

/**
 * Should this click be intercepted, and where should it go?
 *
 * Returns the in-app path to navigate to after the visitor confirms, or `null`
 * when the click is not an in-app page change and must be left alone:
 *
 * - modifier clicks, new-tab targets and downloads are the visitor's choice;
 * - `#hash`, `mailto:`, `tel:` and `javascript:` links do not leave the page;
 * - links to another origin are outside the app;
 * - a link to the current path (a filter, an in-page anchor with a path) is not
 *   leaving the project either.
 *
 * Kept free of DOM types so the rules are testable without a browser.
 */
export function resolveGuardedNavigation(
  link: LinkLike,
  currentUrl: string,
  options?: { modified?: boolean },
): string | null {
  if (options?.modified) {
    return null;
  }
  const raw = link.href?.trim() ?? '';
  if (!raw) {
    return null;
  }
  if (link.download) {
    return null;
  }
  const target = link.target?.trim() ?? '';
  if (target && target !== '_self') {
    return null;
  }
  const lower = raw.toLowerCase();
  if (NON_NAVIGABLE_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return null;
  }

  let next: URL;
  let current: URL;
  try {
    current = new URL(currentUrl);
    next = new URL(raw, current);
  } catch {
    return null;
  }

  if (next.origin !== current.origin) {
    return null;
  }
  if (next.pathname === current.pathname) {
    return null;
  }

  return `${next.pathname}${next.search}${next.hash}`;
}
