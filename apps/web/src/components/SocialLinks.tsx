import { SOCIAL_LINKS, type SocialLink } from '@/lib/social-links';

function FacebookGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      focusable="false"
    >
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

function InstagramGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      focusable="false"
    >
      {/* Outer rounded frame, inner lens and the corner dot, cut out with evenodd. */}
      <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Zm4.5 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM17.25 5.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
    </svg>
  );
}

function SocialGlyph({ id }: { id: SocialLink['id'] }) {
  if (id === 'facebook') {
    return <FacebookGlyph />;
  }
  if (id === 'instagram') {
    return <InstagramGlyph />;
  }
  return null;
}

/**
 * Renders the platform's social profiles as external links. Safe to use from
 * both server and client components (no hooks).
 */
export function SocialLinks({
  className,
  showLabels = true,
}: {
  className?: string;
  showLabels?: boolean;
}) {
  if (SOCIAL_LINKS.length === 0) {
    return null;
  }

  return (
    <ul className={`social-links${className ? ` ${className}` : ''}`}>
      {SOCIAL_LINKS.map((link) => (
        <li key={link.id}>
          <a
            className="social-link"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            title={link.label}
          >
            <span className="social-link-icon" aria-hidden>
              <SocialGlyph id={link.id} />
            </span>
            {showLabels ? (
              <span className="social-link-label">{link.label}</span>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
