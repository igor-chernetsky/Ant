'use client';

import { useEffect } from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onCancel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, busy, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
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
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'danger' : 'primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
