import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import { isAppChallenge, sameValue } from './identity-sign-in';

/**
 * Signing in to a School mobile app (the teacher app) with Munaxa, RFC 8252 style: the app opens
 * the system browser on `/auth/identity/start?school=…&app=<PKCE challenge>`, the ordinary
 * server-side flow signs the person in, and School sends the browser back to the app's registered
 * address (IDENTITY_APP_REDIRECT_URI) with a **hand-off** (in the fragment) instead of setting web
 * cookies.
 *
 * The hand-off is the new session's refresh token, sealed (AES-256-GCM) together with the app's
 * challenge and a two-minute expiry. Nothing in it is readable outside School, and redeeming it
 * (`POST /auth/identity/app-session`) needs the app's PKCE verifier, so a hand-off caught on the
 * way back to the app is useless to whoever caught it. Redeeming rotates the refresh token, so a
 * second redemption is refresh-token reuse and revokes the whole session.
 */
const INFO = 'munaxa-school identity app hand-off v1';
export const APP_HANDOFF_TTL_MS = 2 * 60 * 1_000;

interface Sealed {
  readonly r: string; // refresh token
  readonly c: string; // the app's PKCE challenge
  readonly x: number; // expiry, epoch ms
  readonly m: boolean; // must change password
}

export const handoffKey = (secret: string): Buffer =>
  Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), INFO, 32));

export function sealHandoff(
  key: Buffer,
  value: { refreshToken: string; challenge: string; mustChangePassword: boolean },
  now: number,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(INFO));
  const body: Sealed = {
    r: value.refreshToken,
    c: value.challenge,
    x: now + APP_HANDOFF_TTL_MS,
    m: value.mustChangePassword,
  };
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(body), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export type HandoffOutcome =
  | { readonly ok: true; readonly refreshToken: string; readonly mustChangePassword: boolean }
  | { readonly ok: false; readonly reason: 'MALFORMED' | 'EXPIRED' | 'VERIFIER' };

export function openHandoff(key: Buffer, handoff: unknown, verifier: unknown, now: number) {
  const outcome = open(key, handoff, now);
  if (!outcome.ok) return outcome;
  // RFC 7636 verifier: 43 to 128 unreserved characters.
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
    return { ok: false, reason: 'VERIFIER' } as const;
  }
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  if (!sameValue(challenge, outcome.body.c)) return { ok: false, reason: 'VERIFIER' } as const;
  return {
    ok: true,
    refreshToken: outcome.body.r,
    mustChangePassword: outcome.body.m,
  } as const satisfies HandoffOutcome;
}

function open(
  key: Buffer,
  handoff: unknown,
  now: number,
): { ok: true; body: Sealed } | { ok: false; reason: 'MALFORMED' | 'EXPIRED' } {
  if (typeof handoff !== 'string' || handoff.length > 2048)
    return { ok: false, reason: 'MALFORMED' };
  try {
    const raw = Buffer.from(handoff, 'base64url');
    if (raw.length < 29) return { ok: false, reason: 'MALFORMED' };
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(INFO));
    decipher.setAuthTag(raw.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    const body = JSON.parse(plain.toString('utf8')) as Partial<Sealed>;
    if (
      typeof body.r !== 'string' ||
      !isAppChallenge(body.c) ||
      typeof body.x !== 'number' ||
      typeof body.m !== 'boolean'
    ) {
      return { ok: false, reason: 'MALFORMED' };
    }
    if (now > body.x) return { ok: false, reason: 'EXPIRED' };
    return { ok: true, body: body as Sealed };
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }
}

/**
 * Where the browser goes back to the app: the configured address, never one from the request.
 * The answer travels in the fragment, which a browser never sends to a server, so a hand-off that
 * reaches a web page instead of the app (the app not installed, a link it does not claim) lands
 * in no server log, analytics or referrer.
 */
export function appReturn(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri);
  url.hash = new URLSearchParams(params).toString();
  return url.toString();
}
