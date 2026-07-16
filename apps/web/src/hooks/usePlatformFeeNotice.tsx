'use client';

import { useCallback, useState } from 'react';
import { PlatformFeeNoticeDialog } from '@/components/PlatformFeeNoticeDialog';
import {
  buildPlatformFeeQuote,
  type PlatformFeeQuote,
} from '@/lib/platform-fees';

export function usePlatformFeeNotice() {
  const [state, setState] = useState<{
    quote: PlatformFeeQuote;
    resolve: (value: boolean) => void;
  } | null>(null);

  const acknowledgePlatformFees = useCallback(
    (input: {
      step?: 'sign';
      contractAmount?: number | string | null;
      currency?: string | null;
    }) => {
      const quote = buildPlatformFeeQuote({
        contractAmount: input.contractAmount,
        currency: input.currency,
      });
      return new Promise<boolean>((resolve) => {
        setState({ quote, resolve });
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
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { acknowledgePlatformFees, dialog };
}
