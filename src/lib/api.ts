// The one fetch wrapper for the member area API of a community. Every request says it comes from the app
// (`X-Client: members-app`, `X-Requested-With: fetch`) and carries the session token as Bearer — the software accepts
// that instead of a browser cookie (worker/core/lib/app-client.ts). No cookies are sent (credentials: 'omit').
import type { ApiErrorBody } from './types';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message?: string) {
    super(message ?? code);
  }
}

export interface ApiClient {
  baseUrl: string;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  /** Absolute address of a path the API returned (`/media/…`); full URLs stay. */
  url(path: string): string;
  /** Headers for images and videos of this community (they need the session too). */
  mediaHeaders(): Record<string, string>;
}

/** `https://member.example.de/` or `member.example.de` → `https://member.example.de` (http only for local hosts). */
export function normalizeBaseUrl(input: string): string | null {
  const raw = input.trim().replace(/\/+$/, '');
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    const local = /^(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+)$/.test(u.hostname);
    if (u.protocol !== 'https:' && !local) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function createApi(baseUrl: string, getToken: () => string | null, onUnauthorized: () => void): ApiClient {
  const headers = (json: boolean): Record<string, string> => {
    const h: Record<string, string> = { Accept: 'application/json', 'X-Client': 'members-app', 'X-Requested-With': 'fetch' };
    const token = getToken();
    if (token) h.Authorization = `Bearer ${token}`;
    if (json) h['Content-Type'] = 'application/json';
    return h;
  };

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(baseUrl + path, {
        method, headers: headers(body !== undefined), credentials: 'omit',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'network', 'Keine Verbindung. Prüfe dein Internet und versuch es noch einmal.');
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!res.ok) {
      const err = (data as ApiErrorBody | null)?.error;
      if (res.status === 401 && getToken()) onUnauthorized();
      throw new ApiError(res.status, err?.code ?? `http_${res.status}`, err?.message);
    }
    return data as T;
  }

  return {
    baseUrl,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body ?? {}),
    put: (path, body) => request('PUT', path, body ?? {}),
    url: (path) => (/^https?:\/\//i.test(path) ? path : baseUrl + path),
    mediaHeaders: () => {
      const token = getToken();
      const h: Record<string, string> = { 'X-Client': 'members-app' };
      if (token) h.Authorization = `Bearer ${token}`;
      return h;
    },
  };
}

/** A German sentence for an error of a login or a page (the codes of the software). */
export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'network': return err.message;
      case 'invalid_credentials': return 'E-Mail oder Passwort stimmen nicht.';
      case 'throttled': return 'Zu viele Versuche. Warte kurz und versuch es dann noch einmal.';
      case 'password_change_required': return 'Bitte ändere zuerst dein Passwort auf der Website, dann kannst du dich hier anmelden.';
      case 'not_found': return 'Das gibt es hier nicht (mehr).';
      case 'forbidden': return 'Dafür hast du keinen Zugang.';
      case 'unauthorized': return 'Du bist nicht mehr angemeldet.';
      default:
        if (err.status >= 500) return 'Der Server hat gerade ein Problem. Versuch es gleich noch einmal.';
        // the software's own German sentence (e.g. "Schau dir das Video zuerst zu mindestens 90 % an …")
        return err.message && err.message !== err.code ? err.message : 'Das hat nicht geklappt. Versuch es noch einmal.';
    }
  }
  return 'Das hat nicht geklappt. Versuch es noch einmal.';
}
