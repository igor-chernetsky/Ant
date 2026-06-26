'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { setSessionExpiredHandler } from '@/lib/auth-client';
import { isFilePickerActive } from '@/lib/file-picker-guard';
import {
  fetchSessionProfile,
  logoutSession,
  refreshSessionTokens,
  type MeResponse,
} from '@/lib/session';

interface SessionContextValue {
  me: MeResponse | null;
  setMe: (profile: MeResponse | null) => void;
  ready: boolean;
  refreshSession: () => Promise<MeResponse | null>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [ready, setReady] = useState(false);

  const redirectHome = useCallback(() => {
    router.replace('/');
  }, [router]);

  const handleSessionExpired = useCallback(() => {
    setMe(null);
    redirectHome();
  }, [redirectHome]);

  useEffect(() => {
    setSessionExpiredHandler(handleSessionExpired);
    return () => setSessionExpiredHandler(null);
  }, [handleSessionExpired]);

  useEffect(() => {
    void (async () => {
      try {
        const profile = await fetchSessionProfile();
        setMe(profile);
      } catch {
        setMe(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!me) {
      return;
    }

    const refreshIfNeeded = () => {
      if (isFilePickerActive()) {
        return;
      }
      void refreshSessionTokens();
    };

    const onFocus = () => {
      window.setTimeout(refreshIfNeeded, 800);
    };

    const intervalId = window.setInterval(refreshIfNeeded, 4 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        window.setTimeout(refreshIfNeeded, 800);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [me]);

  const refreshSession = useCallback(async () => {
    const profile = await fetchSessionProfile();
    setMe(profile);
    return profile;
  }, []);

  const signOut = useCallback(async () => {
    await logoutSession();
    setMe(null);
    redirectHome();
  }, [redirectHome]);

  const value = useMemo(
    () => ({ me, setMe, ready, refreshSession, signOut }),
    [me, ready, refreshSession, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}
