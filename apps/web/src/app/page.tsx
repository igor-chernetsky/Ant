'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchMe, type MeResponse } from '@/lib/api';
import { ensureFreshToken, getKeycloak } from '@/lib/keycloak';

type AuthState = 'loading' | 'anonymous' | 'authenticated';

export default function HomePage() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const keycloak = getKeycloak();
    const token = await ensureFreshToken(keycloak);
    if (!token) {
      setMe(null);
      return;
    }
    const profile = await fetchMe(token);
    setMe(profile);
  }, []);

  useEffect(() => {
    const keycloak = getKeycloak();

    keycloak
      .init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      })
      .then((authenticated) => {
        setAuthState(authenticated ? 'authenticated' : 'anonymous');
        if (authenticated) {
          return loadProfile();
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Keycloak init failed');
        setAuthState('anonymous');
      });
  }, [loadProfile]);

  const handleLogin = () => {
    setError(null);
    getKeycloak().login();
  };

  const handleLogout = () => {
    setMe(null);
    getKeycloak().logout({ redirectUri: window.location.origin });
  };

  const handleRefresh = async () => {
    setError(null);
    try {
      await loadProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    }
  };

  return (
    <main>
      <h1>Construction Marketplace</h1>
      <p className="muted">MVP — Keycloak login and API profile</p>

      <div className="card">
        {authState === 'loading' && <p>Loading…</p>}

        {authState === 'anonymous' && (
          <>
            <p>You are not signed in.</p>
            <div className="row">
              <button type="button" className="primary" onClick={handleLogin}>
                Sign in with Keycloak
              </button>
            </div>
          </>
        )}

        {authState === 'authenticated' && (
          <>
            <p>Signed in.</p>
            <div className="row">
              <button type="button" className="secondary" onClick={handleRefresh}>
                Refresh profile
              </button>
              <button type="button" className="secondary" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="card error">
          <pre>{error}</pre>
        </div>
      )}

      {me && (
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>GET /v1/me</h2>
          <pre>{JSON.stringify(me, null, 2)}</pre>
        </div>
      )}
    </main>
  );
}
