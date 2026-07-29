/**
 * Stateless session token: a compact HMAC-SHA256-signed payload, verified on every
 * request by the middleware. Uses Web Crypto only, so it runs in both the Edge
 * middleware and Node route handlers. There is no database — the token IS the session.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function devFallbackSecret(): string {
  return 'munaxa-demo-dev-secret-do-not-use-in-production';
}
/**
 * Resolve the HMAC signing secret. Fails CLOSED in production: if no strong
 * DEMO_SESSION_SECRET is configured we refuse to sign/verify rather than fall back
 * to a publicly-known dev key (which would let anyone forge a session).
 */
function secret(): string {
  const s = process.env.DEMO_SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DEMO_SESSION_SECRET is required (>= 16 chars) in production. Refusing to use the dev fallback.',
    );
  }
  return devFallbackSecret();
}

export interface SessionClaims {
  sid: string; // session id (random per login)
  aid: string; // account id
  org: string; // organization (school) name
  username: string;
  admin: boolean; // demo-admin (can manage demo accounts)
  role: string | null; // assigned persona id for role-locked prospect accounts
  iat: number; // issued-at (epoch seconds)
  exp: number; // expiry (epoch seconds)
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str: string): Uint8Array {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret()) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signSession(claims: SessionClaims): Promise<string> {
  const payload = b64urlEncode(enc.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign('HMAC', await key(), enc.encode(payload) as BufferSource);
  return `${payload}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** Verify signature AND expiry. Returns claims or null. */
export async function verifySession(
  token: string | undefined | null,
): Promise<SessionClaims | null> {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await key(),
      b64urlDecode(sig) as BufferSource,
      enc.encode(payload) as BufferSource,
    );
    if (!ok) return null;
    const claims = JSON.parse(dec.decode(b64urlDecode(payload))) as SessionClaims;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export function ttlMinutes(): number {
  const v = Number(process.env.DEMO_SESSION_TTL_MINUTES);
  return Number.isFinite(v) && v > 0 ? v : 120;
}
