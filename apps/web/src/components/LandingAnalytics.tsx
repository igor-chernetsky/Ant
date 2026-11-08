'use client';

import { useEffect, useRef } from 'react';
import { AnalyticsEvents, trackEvent } from '@/lib/analytics';
import {
  landingEventParams,
  persistLandingContext,
  readLandingContext,
} from '@/lib/utm';

/**
 * Records the first page of the session with the campaign that produced it.
 *
 * Mounted once in the root layout: a full page load (an ad click) mounts it, an
 * in-app navigation does not — which is exactly "landing view per entry".
 */
export function LandingAnalytics() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) {
      return;
    }
    sent.current = true;

    const context = persistLandingContext(
      readLandingContext({
        search: window.location.search,
        pathname: window.location.pathname,
        referrer: document.referrer,
        selfHost: window.location.host,
      }),
    );

    trackEvent(AnalyticsEvents.landingView, landingEventParams(context));
  }, []);

  return null;
}
