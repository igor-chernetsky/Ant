'use client';

import { useCallback, useState } from 'react';
import { PlatformFeeNoticeDialog } from '@/components/PlatformFeeNoticeDialog';
import {
  buildPlatformFeeQuote,
  type PlatformFeeNoticeStep,
  type PlatformFeeQuote,
} from '@/lib/platform-fees';

export function usePlatformFeeNotice() {
  const [state, setState] = useState<{
    quote: PlatformFeeQuote;
    step: PlatformFeeNoticeStep;
    resolve: (value: boolean) => void;
  } | null>(null);

  const acknowledgePlatformFees = useCallback(
    (input: {
      step: PlatformFeeNoticeStep;
      contractAmount?: number | string | null;
      currency?: string | null;
    }) => {
      const quote = buildPlatformFeeQuote({
        contractAmount: input.contractAmount,
        currency: input.currency,
      });
      return new Promise<boolean>((resolve) => {
        setState({ quote, step: input.step, resolve });
      });
    },
    [],
  );

  const close = useCallback((value: boolean) => {
    setState((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const dialog = (
    <PlatformFeeNoticeDialog
      isOpen={state != null}
      quote={state?.quote ?? null}
      step={state?.step ?? 'sign'}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { acknowledgePlatformFees, dialog };
}
