'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BusyLabel } from '@/components/AntSpinner';
import { useTranslation } from '@/components/LocaleProvider';

export interface GuestDraftLeaveDialogProps {
  isOpen: boolean;
  /**
   * An estimate has already been calculated. Leaving keeps the draft for its
   * remaining 24 hours instead of deleting it, because the AI calculation behind
   * it is not free.
   */
  hasEstimate: boolean;
  busy?: boolean;
  /** Continue to registration — keeps the project. */
  onRegister: () => void;
  /** Leave the project page. Deletes the draft when there is no estimate yet. */
  onLeave: () => void;
  /** Stay on the project. */
  onStay: () => void;
}

/**
 * Shown when a guest with an unclaimed project clicks a link to another page.
 *
 * The draft exists only behind the guest cookie, so leaving without registering
 * gives it up: deleted when nothing has been calculated yet, kept for the rest of
 * its 24 hours when an estimate already exists.
 */
export function GuestDraftLeaveDialog({
  isOpen,
  hasEstimate,
  busy = false,
  onRegister,
  onLeave,
  onStay,
}: GuestDraftLeaveDialogProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onStay();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, busy, onStay]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="modal-backdrop confirm-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) {
          onStay();
        }
      }}
    >
      <div
        className="modal confirm-dialog guest-leave-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="guest-leave-dialog-title"
        aria-describedby="guest-leave-dialog-message"
      >
        <div className="confirm-dialog-body">
          <h2 id="guest-leave-dialog-title" className="confirm-dialog-title">
            {t('guestProject.leaveTitle')}
          </h2>
          <p id="guest-leave-dialog-message" className="confirm-dialog-message">
            {hasEstimate
              ? t('guestProject.leaveMessageWithEstimate')
              : t('guestProject.leaveMessageDraft')}
          </p>
        </div>

        <div className="confirm-dialog-actions">
          <button type="button" className="secondary" disabled={busy} onClick={onStay}>
            {t('guestProject.leaveStay')}
          </button>
          <button type="button" className="danger" disabled={busy} onClick={onLeave}>
            <BusyLabel
              busy={busy}
              idle={
                hasEstimate
                  ? t('guestProject.leaveConfirmKeep')
                  : t('guestProject.leaveConfirmDelete')
              }
              busyText={t('common.pleaseWait')}
            />
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={onRegister}
          >
            {t('guestProject.leaveRegister')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
