// The one fetch wrapper for the member area API of a community. Every request says it comes from the app
// (`X-Client: members-app`, `X-Requested-With: fetch`) and carries the session token as Bearer — the software accepts
// that instead of a browser cookie (worker/core/lib/app-client.ts). No cookies are sent (credentials: 'omit').
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { ApiErrorBody } from './types';

/** Names this phone in the member's list of devices (the software keeps only the short label, worker/core/lib/ua.ts). */
const USER_AGENT = Platform.OS === 'web' ? null : `Members-App (${(Device.modelName ?? Platform.OS).replace(/[^\w .,+-]/g, '').slice(0, 40)})`;

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message?: string, readonly fields: Record<string, string> = {}) {
    super(message ?? code);
  }
}

export interface ApiClient {
  baseUrl: string;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
  /** PUT of a file (profile photo): the bytes of a local file as `contentType`. */
  putFile<T>(path: string, fileUri: string, contentType: string): Promise<T>;
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
    if (USER_AGENT) h['User-Agent'] = USER_AGENT;
    const token = getToken();
    if (token) h.Authorization = `Bearer ${token}`;
    if (json) h['Content-Type'] = 'application/json';
    return h;
  };

  async function request<T>(method: string, path: string, body?: unknown, file?: { blob: Blob; type: string }): Promise<T> {
    let res: Response;
    try {
      const h = headers(body !== undefined);
      if (file) h['Content-Type'] = file.type;
      res = await fetch(baseUrl + path, {
        method, headers: h, credentials: 'omit',
        body: file ? file.blob : body === undefined ? undefined : JSON.stringify(body),
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
      // 401 = the session is gone — except a wrong password typed into a form (change password, sudo)
      if (res.status === 401 && getToken() && err?.code !== 'invalid_credentials') onUnauthorized();
      throw new ApiError(res.status, err?.code ?? `http_${res.status}`, err?.message, err?.fields ?? {});
    }
    return data as T;
  }

  return {
    baseUrl,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body ?? {}),
    put: (path, body) => request('PUT', path, body ?? {}),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
    putFile: async (path, fileUri, contentType) => {
      const blob = await (await fetch(fileUri)).blob();
      return request('PUT', path, undefined, { blob, type: contentType });
    },
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
      case 'invalid_credentials': return 'Das Passwort stimmt nicht.';
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
