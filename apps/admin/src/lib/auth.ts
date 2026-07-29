'use client';

/**
 * Browser auth client for the Admin Portal.
 * The session lives entirely in httpOnly cookies set by the API (munaxa_at / munaxa_rt) — JS can
 * never read them, so an XSS cannot exfiltrate the tokens. Every request goes out with
 * `credentials: 'include'` and, for mutating methods, a double-submit CSRF header read from the
 * readable `munaxa_csrf` cookie. An inactivity timeout (see {@link IDLE_TIMEOUT_MS}) signs the
 * user out after a period of no activity.
 */

// The browser always talks to the admin's own origin; Next reverse-proxies /api/v1/* to the API
// (see next.config.mjs). This keeps the httpOnly session + CSRF cookies first-party so they are
// actually sent and readable. The API origin is configured server-side via API_PROXY_TARGET.
export const API_URL = '/api/v1';
const CSRF_COOKIE = 'munaxa_csrf';

/** Auto sign-out after this many milliseconds of user inactivity (15 minutes). */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mustChangePassword?: boolean;
}

export interface Principal {
  userId: string;
  tenantId: string;
  isPlatform: boolean;
  roles: string[];
  permissions: string[];
  // True while the account is on a temporary password and must set a new one before accessing
  // any protected page. Enforced client-side by <Shell> and server-side by MustChangePasswordGuard.
  mustChangePassword?: boolean;
}

/** Read the readable CSRF cookie the API set alongside the httpOnly session cookies. */
export function csrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match?.[1] !== undefined ? decodeURIComponent(match[1]) : null;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[]; detail?: string };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    return message ?? body.detail ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function login(input: {
  identifier: string;
  password: string;
  tenantSlug?: string;
}): Promise<TokenPair> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  // The API sets the httpOnly session cookies; the body is only read for the first-login flag.
  return (await res.json()) as TokenPair;
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    headers: csrfHeaders(),
    credentials: 'include',
    body: '{}',
  }).catch(() => undefined);
}

/** CSRF + content-type headers for mutating requests (the session itself rides in the cookie). */
function csrfHeaders(extra?: HeadersInit): HeadersInit {
  const token = csrfToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'X-CSRF-Token': token } : {}),
    ...(extra ?? {}),
  };
}

/** Authenticated fetch (cookie session) with a one-shot refresh-on-401 retry. */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const isMutating = method !== 'GET' && method !== 'HEAD';
  const withAuth = (): RequestInit => ({
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(isMutating ? csrfHeaders() : {}),
      ...(init.headers ?? {}),
    },
  });

  let res = await fetch(`${API_URL}${path}`, withAuth());
  if (res.status === 401) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: csrfHeaders(),
      credentials: 'include',
      body: '{}',
    });
    if (refreshed.ok) {
      res = await fetch(`${API_URL}${path}`, withAuth());
    }
  }
  return res;
}

export async function getMe(): Promise<Principal> {
  const res = await authFetch('/auth/me');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Principal;
}

/** Request a password-reset email. Always resolves — the API responds 202 to avoid enumeration. */
export async function requestPasswordReset(input: {
  email: string;
  tenantSlug?: string;
}): Promise<void> {
  await fetch(`${API_URL}/auth/password/reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  }).catch(() => undefined);
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}): Promise<void> {
  const res = await authFetch('/auth/password/change', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
}
