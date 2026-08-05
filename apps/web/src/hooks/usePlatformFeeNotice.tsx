'use client';

import { useCallback, useState } from 'react';
import {
  PlatformFeeNoticeDialog,
  type PlatformFeeDialogMode,
} from '@/components/PlatformFeeNoticeDialog';
import {
  buildPlatformFeeQuote,
  type PlatformFeeQuote,
} from '@/lib/platform-fees';
import type { ContractSignatureAuth } from '@/lib/contracts';
import { createContractSignatureRequest } from '@/lib/signature-requests';

export type SignAuthorizationResult =
  | 'ready_to_sign'
  | 'aborted'
  | 'request_sent';

export function usePlatformFeeNotice() {
  const [state, setState] = useState<{
    mode: PlatformFeeDialogMode;
    quote: PlatformFeeQuote | null;
    rejectionReason: string | null;
    profileHref: string;
    projectId: string | null;
    resolve: (value: SignAuthorizationResult) => void;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback((value: SignAuthorizationResult) => {
    setState((current) => {
      current?.resolve(value);
      return null;
    });
    setBusy(false);
    setError(null);
  }, []);

  const ensureSignAuthorized = useCallback(
    (input: {
      projectId: string;
      signatureAuth: ContractSignatureAuth | null | undefined;
      contractAmount?: number | string | null;
      currency?: string | null;
      profileHref?: string;
    }): Promise<SignAuthorizationResult> => {
      const auth = input.signatureAuth;
      if (auth?.platformFeePaid) {
        return Promise.resolve('ready_to_sign');
      }

      const quote = buildPlatformFeeQuote({
        contractAmount: input.contractAmount,
        currency: input.currency,
      });
      const profileHref = input.profileHref ?? '/contractor';
      const pending = auth?.latestRequest?.status === 'pending';

      return new Promise<SignAuthorizationResult>((resolve) => {
        setError(null);
        if (!auth?.hasBankDetails) {
          setState({
            mode: 'bank_required',
            quote: null,
            rejectionReason: null,
            profileHref,
            projectId: input.projectId,
            resolve,
          });
          return;
        }
        if (pending) {
          setState({
            mode: 'pending',
            quote: null,
            rejectionReason: null,
            profileHref,
            projectId: input.projectId,
            resolve,
          });
          return;
        }
        setState({
          mode: 'request',
          quote,
          rejectionReason:
            auth?.latestRequest?.status === 'rejected'
              ? auth.latestRequest.rejectionReason
              : null,
          profileHref,
          projectId: input.projectId,
          resolve,
        });
      });
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    if (!state || state.mode !== 'request' || !state.projectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createContractSignatureRequest(state.projectId);
      setState((current) =>
        current
          ? {
              ...current,
              mode: 'request_sent',
              quote: null,
            }
          : null,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to submit signature request',
      );
    } finally {
      setBusy(false);
    }
  }, [state]);

  const dialog = (
    <PlatformFeeNoticeDialog
      isOpen={state != null}
      mode={state?.mode ?? 'request'}
      quote={state?.quote ?? null}
      busy={busy}
      error={error}
      rejectionReason={state?.rejectionReason}
      profileHref={state?.profileHref}
      onConfirm={() => {
        void handleConfirm();
      }}
      onCancel={() =>
        close(state?.mode === 'request_sent' ? 'request_sent' : 'aborted')
      }
    />
  );

  return { ensureSignAuthorized, dialog };
}
