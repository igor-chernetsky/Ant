'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/components/LocaleProvider';

export type FlashToastTone = 'success' | 'error';

export type FlashToastState = {
  message: string;
  tone: FlashToastTone;
};

const TOAST_TTL_MS = 5_000;

export function FlashToast({
  toast,
  onDismiss,
}: {
  toast: FlashToastState | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, TOAST_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!mounted || !toast) return null;

  return createPortal(
    <div className="flash-toasts" aria-live="polite">
      <div
        className={`flash-toast flash-toast--${toast.tone}`}
        role={toast.tone === 'error' ? 'alert' : 'status'}
      >
        <p className="flash-toast-message">{toast.message}</p>
        <button
          type="button"
          className="icon-button flash-toast-dismiss"
          aria-label={t('common.close')}
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
