import * as SecureStore from 'expo-secure-store';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { api, MobileUser, SessionTokens } from './api';

const ACCESS_KEY = 'session.access';
const REFRESH_KEY = 'session.refresh';

type SessionContextValue = {
  ready: boolean;
  user: MobileUser | null;
  accessToken: string | null;
  signIn: (tokens: SessionTokens) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
        if (!refreshToken) return;
        const tokens = await api.refresh(refreshToken);
        if (active) {
          await persist(tokens);
          setUser(tokens.user);
          setAccessToken(tokens.access_token);
        }
      } catch {
        await clearStoredSession();
      } finally {
        if (active) setReady(true);
      }
    }
    void restore();
    return () => { active = false; };
  }, []);

  async function persist(tokens: SessionTokens) {
    await SecureStore.setItemAsync(ACCESS_KEY, tokens.access_token);
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh_token);
  }

  async function clearStoredSession() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }

  async function signIn(tokens: SessionTokens) {
    await persist(tokens);
    setUser(tokens.user);
    setAccessToken(tokens.access_token);
  }

  async function signOut() {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    try {
      if (refreshToken && accessToken) await api.logout(refreshToken, accessToken);
    } catch {
      // A local sign-out must still complete when the device is offline.
    }
    await clearStoredSession();
    setUser(null);
    setAccessToken(null);
  }

  const value = useMemo(() => ({ ready, user, accessToken, signIn, signOut }), [ready, user, accessToken]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession debe usarse dentro de SessionProvider.');
  return context;
}
