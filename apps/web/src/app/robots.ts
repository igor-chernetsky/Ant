import type { MetadataRoute } from 'next';
import { resolveAppBaseUrl } from '@/lib/app-base-url';

export default function robots(): MetadataRoute.Robots {
  const base = resolveAppBaseUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/account',
        '/contractor',
        '/designer',
        '/api/',
        '/projects/*/bids',
        '/reset-password',
        '/email-verified',
        '/email-unsubscribe',
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
