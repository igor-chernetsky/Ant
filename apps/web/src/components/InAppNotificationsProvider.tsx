'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSession } from '@/components/SessionProvider';
import {
  fetchInAppNotifications,
  markInAppNotificationsRead,
  type InAppNotification,
} from '@/lib/in-app-notifications';

const POLL_INTERVAL_MS = 20_000;

interface InAppNotificationsContextValue {
  notifications: InAppNotification[];
  unreadCount: number;
  toasts: InAppNotification[];
  refresh: () => Promise<void>;
  markRead: (ids?: string[]) => Promise<void>;
  dismissToast: (id: string) => void;
}

const InAppNotificationsContext =
  createContext<InAppNotificationsContextValue | null>(null);

export function InAppNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { me, ready } = useSession();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<InAppNotification[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);

  const applyList = useCallback(
    (list: { notifications: InAppNotification[]; unreadCount: number }) => {
      const nextIds = new Set(list.notifications.map((item) => item.id));

      if (hydratedRef.current) {
        const fresh = list.notifications.filter(
          (item) => !item.readAt && !knownIdsRef.current.has(item.id),
        );
        if (fresh.length > 0) {
          setToasts((current) => {
            const existing = new Set(current.map((item) => item.id));
            const incoming = fresh.filter((item) => !existing.has(item.id));
            return [...incoming, ...current].slice(0, 5);
          });
        }
      }

      knownIdsRef.current = nextIds;
      hydratedRef.current = true;
      setNotifications(list.notifications);
      setUnreadCount(list.unreadCount);
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!me) {
      knownIdsRef.current = new Set();
      hydratedRef.current = false;
      setNotifications([]);
      setUnreadCount(0);
      setToasts([]);
      return;
    }
    try {
      const list = await fetchInAppNotifications();
      applyList(list);
    } catch {
      // Keep previous state on transient poll failures.
    }
  }, [applyList, me]);

  const markRead = useCallback(
    async (ids?: string[]) => {
      if (!me) return;
      try {
        const list = await markInAppNotificationsRead(ids);
        applyList(list);
        if (ids?.length) {
          setToasts((current) =>
            current.filter((item) => !ids.includes(item.id)),
          );
        } else {
          setToasts([]);
        }
      } catch {
        // Ignore mark-read failures; next poll will reconcile.
      }
    },
    [applyList, me],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, refresh]);

  useEffect(() => {
    if (!me) return;

    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      void refresh();
    };

    const intervalId = window.setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [me, refresh]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      toasts,
      refresh,
      markRead,
      dismissToast,
    }),
    [notifications, unreadCount, toasts, refresh, markRead, dismissToast],
  );

  return (
    <InAppNotificationsContext.Provider value={value}>
      {children}
    </InAppNotificationsContext.Provider>
  );
}

export function useInAppNotifications(): InAppNotificationsContextValue {
  const context = useContext(InAppNotificationsContext);
  if (!context) {
    throw new Error(
      'useInAppNotifications must be used within InAppNotificationsProvider',
    );
  }
  return context;
}
