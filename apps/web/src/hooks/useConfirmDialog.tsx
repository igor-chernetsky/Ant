'use client';

import { useCallback, useState } from 'react';
import { ConfirmDialog, type ConfirmDialogProps } from '@/components/ConfirmDialog';

export type ConfirmOptions = Pick<
  ConfirmDialogProps,
  'title' | 'message' | 'confirmLabel' | 'cancelLabel' | 'tone'
>;

export function useConfirmDialog() {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const close = useCallback((value: boolean) => {
    setState((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const dialog = (
    <ConfirmDialog
      isOpen={state != null}
      title={state?.options.title ?? ''}
      message={state?.options.message ?? ''}
      confirmLabel={state?.options.confirmLabel}
      cancelLabel={state?.options.cancelLabel}
      tone={state?.options.tone}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog };
}
