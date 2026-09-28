'use client';

import { useEffect, useState } from 'react';
import {
  fetchPlatformFeeTrialState,
  PLATFORM_FEES_TRIAL_ACTIVE,
  type PlatformFeeTrialState,
} from '@/lib/platform-fees';

/**
 * Trial state configured in Admin → Settings, fetched once per page.
 *
 * Returns a constant-based fallback until the request resolves, so the first
 * paint shows the trial (never an unexpected charge) and then corrects itself.
 */
export function usePlatformFeeTrial(): PlatformFeeTrialState {
  const [state, setState] = useState<PlatformFeeTrialState>({
    trialActive: PLATFORM_FEES_TRIAL_ACTIVE,
    trialEndsAt: null,
  });

  useEffect(() => {
    let active = true;
    void fetchPlatformFeeTrialState().then((next) => {
      if (active) {
        setState(next);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
