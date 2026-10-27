'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AntSpinner } from '@/components/AntSpinner';
import { useTranslation } from '@/components/LocaleProvider';

export interface LoadingOverlayProps {
  isOpen: boolean;
  /** What is happening, announced to screen readers and shown under the spinner. */
  label?: string;
}

/**
 * Blocking waiting overlay for a long request (the estimate recalculation calls
 * the model, so it can take a while).
 *
 * Uses the same backdrop and glass card as the dialogs, so it looks like the rest
 * of the app instead of a bare spinner. There is deliberately no dismiss action:
 * the request is already in flight and the caller keeps the trigger disabled until
 * it settles.
 */
export function LoadingOverlay({ isOpen, label }: LoadingOverlayProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('common.pleaseWait');

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="modal-backdrop loading-overlay-backdrop">
      <div
        className="modal loading-overlay"
        role="status"
        aria-live="assertive"
        aria-busy="true"
        aria-label={resolvedLabel}
      >
        <AntSpinner size="lg" label={resolvedLabel} />
        <p className="loading-overlay-label">{resolvedLabel}</p>
      </div>
    </div>,
    document.body,
  );
}
