'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/components/LocaleProvider';
import { addAccountRoles, type SelfServeAccountRole } from '@/lib/account-roles';
import { trackEvent } from '@/lib/analytics';
import { ensureSessionFresh } from '@/lib/session';

interface BecomeRoleModalProps {
  role: SelfServeAccountRole;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function BecomeRoleModal({
  role,
  isOpen,
  onClose,
  onSuccess,
}: BecomeRoleModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const isClient = role === 'client';
  const title =
    role === 'client'
      ? t('account.becomeClientTitle')
      : role === 'contractor'
        ? t('account.becomeContractorTitle')
        : t('account.becomeDesignerTitle');
  const lead =
    role === 'client'
      ? t('account.becomeClientLead')
      : role === 'contractor'
        ? t('account.becomeContractorLead')
        : t('account.becomeDesignerLead');
  const agreementHref = isClient ? '/client-agreement' : '/contractor-agreement';
  const agreementLabel = isClient
    ? t('footer.clientAgreement')
    : t('footer.contractorAgreement');
  const agreementPrefix = isClient
    ? t('auth.acceptClientAgreementPrefix')
    : t('auth.acceptContractorAgreementPrefix');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!accepted) {
      setError(t('account.becomeRoleAcceptRequired'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await ensureSessionFresh();
      const result = await addAccountRoles({
        roles: [role],
        acceptedAgreement: true,
      });
      trackEvent('add_account_role', {
        role,
        already_had: result.alreadyHad.includes(role),
      });
      await onSuccess();
      setAccepted(false);
      onClose();
      if (role === 'contractor') {
        router.push('/contractor');
      } else if (role === 'designer') {
        router.push('/designer');
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('account.becomeRoleFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="become-role-title"
      >
        <div className="modal-header">
          <h2 id="become-role-title">{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t('common.close')}
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="muted modal-subtitle">{lead}</p>

        <form className="modal-form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="checkbox-label auth-legal-consent">
            <input
              type="checkbox"
              checked={accepted}
              disabled={busy}
              onChange={(event) => setAccepted(event.target.checked)}
              required
            />
            <span>
              {agreementPrefix}{' '}
              <Link
                href={agreementHref}
                className="text-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {agreementLabel}
              </Link>
            </span>
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="row">
            <button
              type="submit"
              className="primary"
              disabled={busy || !accepted}
            >
              {busy ? t('common.pleaseWait') : t('account.becomeRoleConfirm')}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
