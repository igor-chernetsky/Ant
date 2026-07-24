'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useInAppNotifications } from '@/components/InAppNotificationsProvider';
import { useTranslation } from '@/components/LocaleProvider';
import {
  formatInAppNotificationBody,
  formatInAppNotificationTitle,
} from '@/lib/in-app-notification-copy';
import type { InAppNotification } from '@/lib/in-app-notifications';

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function NotificationRow({
  item,
  onClick,
}: {
  item: InAppNotification;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const title = formatInAppNotificationTitle(t, item);
  const body = formatInAppNotificationBody(t, item);
  const unread = !item.readAt;

  const content = (
    <>
      <span className="header-notifications-item-title">{title}</span>
      {body && <span className="header-notifications-item-body">{body}</span>}
      <span className="header-notifications-item-time muted">
        {new Date(item.createdAt).toLocaleString()}
      </span>
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className={`header-notifications-item${unread ? ' is-unread' : ''}`}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`header-notifications-item${unread ? ' is-unread' : ''}`}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

export function HeaderNotifications() {
  const { t } = useTranslation();
  const { notifications, unreadCount, markRead } = useInAppNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleOpen = () => {
    setOpen((current) => !current);
  };

  const handleItemClick = (item: InAppNotification) => {
    setOpen(false);
    if (!item.readAt) {
      void markRead([item.id]);
    }
  };

  return (
    <div className="header-notifications" ref={rootRef}>
      <button
        type="button"
        className="header-notifications-trigger"
        aria-label={t('notifications.ariaLabel')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={handleOpen}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="header-notifications-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="header-notifications-panel"
          role="dialog"
          aria-label={t('notifications.title')}
        >
          <div className="header-notifications-panel-header">
            <strong>{t('notifications.title')}</strong>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-link header-notifications-mark-all"
                onClick={() => void markRead()}
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="muted header-notifications-empty">
              {t('notifications.empty')}
            </p>
          ) : (
            <div className="header-notifications-list">
              {notifications.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onClick={() => handleItemClick(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
