'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FlashToast, type FlashToastState } from '@/components/FlashToast';
import { useTranslation } from '@/components/LocaleProvider';
import { submitContactMessage } from '@/lib/contact';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal/branding';
import type { MeResponse } from '@/lib/session';

interface ContactUsModalProps {
  isOpen: boolean;
  onClose: () => void;
  me?: MeResponse | null;
}

export function ContactUsModal({ isOpen, onClose, me }: ContactUsModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<FlashToastState | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEmail(me?.email?.trim() ?? '');
    setPhone('');
    setMessage('');
    setFlash(null);
  }, [isOpen, me?.email]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, busy, onClose]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFlash(null);
    try {
      await submitContactMessage({
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        message: message.trim(),
      });
      setFlash({
        tone: 'success',
        message: t('header.contactFormSent'),
      });
      setMessage('');
    } catch (err: unknown) {
      setFlash({
        tone: 'error',
        message:
          err instanceof Error ? err.message : t('header.contactFormSendFailed'),
      });
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      <div
        className="modal-backdrop contact-us-backdrop"
        role="presentation"
        onClick={(event) => {
          if (!busy && event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className="modal contact-us-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-us-title"
        >
          <div className="contact-us-header">
            <h2 id="contact-us-title" className="section-title">
              {t('header.contactUs')}
            </h2>
            <button
              type="button"
              className="icon-button contact-us-close"
              aria-label={t('common.close')}
              onClick={onClose}
              disabled={busy}
            >
              ×
            </button>
          </div>

          <p className="muted contact-us-lead">{t('header.contactDialogLead')}</p>

          <div className="contact-us-actions">
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="secondary">
              {t('header.contactSendEmail', { email: LEGAL_CONTACT_EMAIL })}
            </a>
          </div>

          <p className="contact-us-divider">{t('header.contactOrSendForm')}</p>

          <form className="contact-us-form" onSubmit={(e) => void handleSubmit(e)}>
            <label className="contact-us-field">
              {t('header.contactFormEmail')}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={busy}
              />
            </label>

            <label className="contact-us-field">
              {t('header.contactFormPhone')}
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+66 ..."
                autoComplete="tel"
                disabled={busy}
              />
            </label>

            <p className="muted contact-us-hint">{t('header.contactFormHint')}</p>

            <label className="contact-us-field">
              {t('header.contactFormMessage')}
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('header.contactFormMessagePlaceholder')}
                disabled={busy}
                required
              />
            </label>

            <div className="contact-us-form-actions">
              <button type="button" className="secondary" onClick={onClose} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="primary"
                disabled={busy || !message.trim() || (!email.trim() && !phone.trim())}
              >
                {busy ? t('common.pleaseWait') : t('header.contactFormSubmit')}
              </button>
            </div>
          </form>
        </div>
      </div>

      <FlashToast toast={flash} onDismiss={() => setFlash(null)} />
    </>,
    document.body,
  );
}
