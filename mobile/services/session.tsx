import * as SecureStore from 'expo-secure-store';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, api, MobileUser, SessionTokens } from './api';

const ACCESS_KEY = 'session.access';
const REFRESH_KEY = 'session.refresh';
export type SessionRequest = <T,>(path: string, init?: RequestInit) => Promise<T>;

type SessionContextValue = {
  ready: boolean;
  user: MobileUser | null;
  accessToken: string | null;
  signIn: (tokens: SessionTokens) => Promise<void>;
  signOut: () => Promise<void>;
  request: <T,>(path: string, init?: RequestInit) => Promise<T>;
  renewAccessToken: () => Promise<string>;
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

  const persist = useCallback(async (tokens: SessionTokens) => {
    await SecureStore.setItemAsync(ACCESS_KEY, tokens.access_token);
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh_token);
  }, []);

  const clearStoredSession = useCallback(async () => {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }, []);

  const signIn = useCallback(async (tokens: SessionTokens) => {
    await persist(tokens);
    setUser(tokens.user);
    setAccessToken(tokens.access_token);
  }, [persist]);

  const signOut = useCallback(async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    try {
      if (refreshToken && accessToken) await api.logout(refreshToken, accessToken);
    } catch {
      // A local sign-out must still complete when the device is offline.
    }
    await clearStoredSession();
    setUser(null);
    setAccessToken(null);
  }, [accessToken, clearStoredSession]);

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}) => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!accessToken || !refreshToken) throw new Error('La sesión expiró. Inicia sesión nuevamente.');
    try {
      return await api.authenticated<T>(path, init, accessToken, refreshToken, async (tokens) => {
        await persist(tokens);
        setAccessToken(tokens.access_token);
        setUser(tokens.user);
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearStoredSession();
        setAccessToken(null);
        setUser(null);
      }
      throw error;
    }
  }, [accessToken, clearStoredSession, persist]);

  const renewAccessToken = useCallback(async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) throw new Error('La sesión expiró. Inicia sesión nuevamente.');
    try {
      const tokens = await api.refresh(refreshToken);
      await persist(tokens);
      setAccessToken(tokens.access_token);
      setUser(tokens.user);
      return tokens.access_token;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearStoredSession();
        setAccessToken(null);
        setUser(null);
      }
      throw error;
    }
  }, [clearStoredSession, persist]);

  const value = useMemo(() => ({ ready, user, accessToken, signIn, signOut, request, renewAccessToken }), [ready, user, accessToken, signIn, signOut, request, renewAccessToken]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession debe usarse dentro de SessionProvider.');
  return context;
}
