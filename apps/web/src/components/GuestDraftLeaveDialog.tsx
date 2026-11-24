'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BusyLabel } from '@/components/AntSpinner';
import { useTranslation } from '@/components/LocaleProvider';

export interface GuestDraftLeaveDialogProps {
  isOpen: boolean;
  /**
   * An estimate has already been calculated. It only changes the wording: leaving
   * never deletes the project — the draft stays for the rest of its 24 hours in
   * both cases, so the team can see what the visitor was asking for.
   */
  hasEstimate: boolean;
  busy?: boolean;
  /** Continue to registration — keeps the project. */
  onRegister: () => void;
  /** Leave the project page. The draft is kept, not deleted. */
  onLeave: () => void;
  /** Stay on the project. */
  onStay: () => void;
}

/**
 * Shown when a guest with an unclaimed project clicks a link to another page.
 *
 * Leaving no longer throws the draft away: it lives for its full 24 hours whatever
 * the visitor does, so an abandoned attempt is still visible to the team in
 * Admin → Projects (guest filter) and the visitor can come back in the same browser.
 * Only an explicit delete from the project's danger zone removes it early.
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

        {/* One row on purpose: three short answers (stay / leave / register) used to
            wrap into two rows and the primary action jumped between lines. */}
        <div className="confirm-dialog-actions guest-leave-actions">
          <button type="button" className="secondary" disabled={busy} onClick={onStay}>
            {t('guestProject.leaveStay')}
          </button>
          <button type="button" className="ghost" disabled={busy} onClick={onLeave}>
            <BusyLabel
              busy={busy}
              idle={t('guestProject.leaveConfirm')}
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
