import { ExplainerLandingPage } from '@/components/explainer/ExplainerLandingPage';
import { JsonLd } from '@/components/JsonLd';
import { explainerFaqItems, faqPageJsonLd } from '@/lib/seo-jsonld';
import { marketingPages } from '@/lib/seo';

export const metadata = marketingPages.forClients;

export default function ForClientsPage() {
  return (
    <>
      <JsonLd data={faqPageJsonLd(explainerFaqItems('clients'))} />
      <ExplainerLandingPage audience="clients" />
    </>
  );
}
