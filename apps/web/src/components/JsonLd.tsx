import type { JsonLdObject } from '@/lib/seo-jsonld';
import { jsonLdScript } from '@/lib/seo-jsonld';

interface JsonLdProps {
  data: JsonLdObject | JsonLdObject[];
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }}
    />
  );
}
