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
import {
  fetchSessionProfile,
  logoutSession,
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

  const handleSessionExpired = useCallback(() => {
    setMe(null);
    router.push('/');
  }, [router]);

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

  const refreshSession = useCallback(async () => {
    const profile = await fetchSessionProfile();
    setMe(profile);
    return profile;
  }, []);

  const signOut = useCallback(async () => {
    await logoutSession();
    setMe(null);
  }, []);

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
