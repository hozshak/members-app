// Who is using the app: the chosen community (its address, name, colour, logo — from /api/public/bootstrap) and the
// session (token in the phone's secure storage, the member from /api/auth/me). Every screen gets the API client of the
// community from here. A 401 anywhere ends the session (back to the login).
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, createApi, normalizeBaseUrl, type ApiClient } from './api';
import { getItem, removeItem, setItem } from './storage';
import type { Bootstrap, LoginResponse, Me } from './types';
import { clearRoutineWidget } from './widget';

export interface Community {
  url: string;
  name: string;
  accentColor: string;
  logoUrl: string | null;
  salutation: 'du' | 'sie';
}

interface SessionState {
  ready: boolean;
  community: Community | null;
  token: string | null;
  me: Me | null;
  api: ApiClient | null;
  /** `name`: shown instead of the community's own app name (the communities of the start screen). */
  chooseCommunity(input: string, name?: string): Promise<void>;
  forgetCommunity(): Promise<void>;
  login(login: string, password: string): Promise<void>;
  logout(): Promise<void>;
  /** After a password change the software issues a new session token (the old one ends). */
  replaceToken(token: string): Promise<void>;
  /** Reload the member (name, photo) after a profile change. */
  refreshMe(): Promise<void>;
}

const COMMUNITY_KEY = 'members.community';
const TOKEN_KEY = 'members.token';

const SessionContext = createContext<SessionState | null>(null);

/** The current token outside React state, for the API client's requests (read lazily, never during render). */
function createTokenHolder() {
  let current: string | null = null;
  return { get: (): string | null => current, set: (t: string | null): void => { current = t; } };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [community, setCommunity] = useState<Community | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  // the API client reads the token from this holder whenever it sends a request (set wherever the token changes)
  const [tokens] = useState(createTokenHolder);

  const endSession = useCallback(async () => {
    tokens.set(null);
    setToken(null);
    setMe(null);
    qc.clear();
    clearRoutineWidget();
    await removeItem(TOKEN_KEY);
  }, [qc, tokens]);

  const api = useMemo(
    () => (community ? createApi(community.url, tokens.get, () => void endSession()) : null),
    [community, endSession, tokens],
  );

  // start: community and token from the storage; the token is checked once (offline it is kept)
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [storedCommunity, storedToken] = await Promise.all([getItem(COMMUNITY_KEY), getItem(TOKEN_KEY)]);
      let c: Community | null = null;
      try { c = storedCommunity ? (JSON.parse(storedCommunity) as Community) : null; } catch { c = null; }
      if (!alive) return;
      setCommunity(c);
      if (c && storedToken) {
        tokens.set(storedToken);
        try {
          const m = await createApi(c.url, () => storedToken, () => undefined).get<Me>('/api/auth/me');
          if (!alive) return;
          setToken(storedToken);
          setMe(m);
        } catch (err) {
          if (!alive) return;
          if (err instanceof ApiError && err.status === 401) {
            tokens.set(null);
            await removeItem(TOKEN_KEY);
          } else {
            setToken(storedToken); // offline or server trouble: stay logged in, the screens show their own errors
          }
        }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [tokens]);

  const chooseCommunity = useCallback(async (input: string, name?: string) => {
    const url = normalizeBaseUrl(input);
    if (!url) throw new ApiError(0, 'bad_address', 'Diese Adresse sieht nicht richtig aus.');
    let b: Bootstrap;
    try {
      b = await createApi(url, () => null, () => undefined).get<Bootstrap>('/api/public/bootstrap');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'network') throw err;
      throw new ApiError(0, 'not_a_community', 'Unter dieser Adresse gibt es keinen Mitgliederbereich.');
    }
    if (!b || typeof b.appName !== 'string') throw new ApiError(0, 'not_a_community', 'Unter dieser Adresse gibt es keinen Mitgliederbereich.');
    const c: Community = {
      url, name: name ?? b.appName, accentColor: /^#[0-9a-f]{6}$/i.test(b.accentColor) ? b.accentColor : '#C2410C',
      logoUrl: b.logoUrl ? (/^https?:/i.test(b.logoUrl) ? b.logoUrl : url + b.logoUrl) : null,
      salutation: b.salutation === 'sie' ? 'sie' : 'du',
    };
    await setItem(COMMUNITY_KEY, JSON.stringify(c));
    setCommunity(c);
  }, []);

  const logout = useCallback(async () => {
    if (api && tokens.get()) {
      try { await api.post('/api/auth/logout'); } catch { /* the session ends locally anyway */ }
    }
    await endSession();
  }, [api, endSession, tokens]);

  const forgetCommunity = useCallback(async () => {
    await logout();
    await removeItem(COMMUNITY_KEY);
    setCommunity(null);
  }, [logout]);

  const login = useCallback(async (loginName: string, password: string) => {
    if (!api) throw new ApiError(0, 'no_community');
    const res = await api.post<LoginResponse>('/api/auth/login', { login: loginName.trim(), password, remember: true });
    if (!res.token) throw new ApiError(0, 'old_server', 'Dieser Mitgliederbereich unterstützt die App noch nicht.');
    if (res.me.restricted || res.me.mustChangePassword) {
      try { await createApi(api.baseUrl, () => res.token ?? null, () => undefined).post('/api/auth/logout'); } catch { /* ignore */ }
      throw new ApiError(403, 'password_change_required');
    }
    await setItem(TOKEN_KEY, res.token);
    tokens.set(res.token);
    setToken(res.token);
    setMe(res.me);
  }, [api, tokens]);

  const replaceToken = useCallback(async (next: string) => {
    await setItem(TOKEN_KEY, next);
    tokens.set(next);
    setToken(next);
  }, [tokens]);

  const refreshMe = useCallback(async () => {
    if (!api) return;
    try { setMe(await api.get<Me>('/api/auth/me')); } catch { /* the screens show their own errors */ }
  }, [api]);

  const value = useMemo<SessionState>(
    () => ({ ready, community, token, me, api, chooseCommunity, forgetCommunity, login, logout, replaceToken, refreshMe }),
    [ready, community, token, me, api, chooseCommunity, forgetCommunity, login, logout, replaceToken, refreshMe],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}

/** The API client of the logged-in community (screens behind the login only). */
export function useApi(): ApiClient {
  const { api } = useSession();
  if (!api) throw new Error('useApi without community');
  return api;
}
