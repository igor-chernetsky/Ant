'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useInAppNotifications } from '@/components/InAppNotificationsProvider';
import { useTranslation } from '@/components/LocaleProvider';
import {
  formatInAppNotificationBody,
  formatInAppNotificationTitle,
} from '@/lib/in-app-notification-copy';

const TOAST_TTL_MS = 8_000;

export function NotificationToasts() {
  const { t } = useTranslation();
  const { toasts, dismissToast, markRead } = useInAppNotifications();

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismissToast(toast.id), TOAST_TTL_MS),
    );
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="notification-toasts" aria-live="polite">
      {toasts.map((toast) => {
        const title = formatInAppNotificationTitle(t, toast);
        const body = formatInAppNotificationBody(t, toast);
        const onActivate = () => {
          dismissToast(toast.id);
          if (!toast.readAt) {
            void markRead([toast.id]);
          }
        };

        return (
          <div key={toast.id} className="notification-toast">
            <div className="notification-toast-copy">
              <strong>{title}</strong>
              {body && <p>{body}</p>}
            </div>
            <div className="notification-toast-actions">
              {toast.href ? (
                <Link
                  href={toast.href}
                  className="primary notification-toast-cta"
                  onClick={onActivate}
                >
                  {t('notifications.open')}
                </Link>
              ) : null}
              <button
                type="button"
                className="icon-button"
                aria-label={t('common.close')}
                onClick={() => dismissToast(toast.id)}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
