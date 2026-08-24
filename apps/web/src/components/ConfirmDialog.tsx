'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BusyLabel } from '@/components/AntSpinner';
import { useTranslation } from '@/components/LocaleProvider';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Single primary button (alert / info). Cancel is hidden. */
  hideCancel?: boolean;
  tone?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  hideCancel = false,
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const resolvedConfirmLabel =
    confirmLabel ?? (hideCancel ? t('common.close') : t('common.confirm'));
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel');

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onCancel();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, busy, onCancel]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="modal-backdrop confirm-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="confirm-dialog-body">
          <h2 id="confirm-dialog-title" className="confirm-dialog-title">
            {title}
          </h2>
          <p id="confirm-dialog-message" className="confirm-dialog-message">
            {message}
          </p>
        </div>

        <div className="confirm-dialog-actions">
          {!hideCancel && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onCancel}
            >
              {resolvedCancelLabel}
            </button>
          )}
          <button
            type="button"
            className={tone === 'danger' ? 'danger' : 'primary'}
            disabled={busy}
            aria-busy={busy}
            onClick={onConfirm}
          >
            <BusyLabel
              busy={busy}
              idle={resolvedConfirmLabel}
              busyText={t('common.pleaseWait')}
            />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
