import { ExplainerLandingPage } from '@/components/explainer/ExplainerLandingPage';
import { JsonLd } from '@/components/JsonLd';
import { explainerFaqItems, faqPageJsonLd } from '@/lib/seo-jsonld';
import { marketingPages } from '@/lib/seo';

export const metadata = marketingPages.forContractors;

export default function ForContractorsPage() {
  return (
    <>
      <JsonLd data={faqPageJsonLd(explainerFaqItems('contractors'))} />
      <ExplainerLandingPage audience="contractors" />
    </>
  );
}
