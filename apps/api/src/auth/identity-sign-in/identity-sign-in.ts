import {
  createHash,
  createHmac,
  createPublicKey,
  createVerify,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Sign in with Munaxa Identity (munaxa-identity ADR-0008): School as an OpenID Connect relying
 * party of Identity, exactly as it would be of any company directory.
 *
 * School keeps its own users, roles and permissions. Identity only answers "who is this", with
 * its MFA, lockout, session revocation and Microsoft/Google company sign-in; School then signs
 * in the School user of that school with the same verified email, and remembers Identity's
 * subject on first use so a later account with the same address in Identity cannot take it over.
 *
 * Each school (tenant slug) has its own Identity client, bound in Identity to one organisation,
 * so a school only ever receives people from the organisation it is paired with. The id token is
 * also checked here against that organisation.
 *
 *     IDENTITY_SIGN_IN               enabled | disabled (default)
 *     IDENTITY_ISSUER                https://id.example (Identity's MUNAXA_TOKEN_ISSUER)
 *     IDENTITY_SIGN_IN_REDIRECT_URI  https://school.example/api/v1/auth/identity/callback
 *     IDENTITY_SIGN_IN_CLIENTS       school-slug|client-id|organisation   (`;` between)
 *     IDENTITY_SIGN_IN_CLIENT_SECRETS client-id=<32+ base64url characters> (`,` between; a secret)
 *     IDENTITY_PUBLIC_KEYS           [{"kid":"…","publicKey":"-----BEGIN PUBLIC KEY-----…"}]
 *
 * Pure: no I/O, so it is shared by the environment check, the service and the tests.
 */

export interface IdentityClient {
  readonly school: string;
  readonly clientId: string;
  readonly organisation: string;
  readonly secret: string;
}

const SCHOOL = /^[a-z0-9][a-z0-9-]{0,62}$/;
const CLIENT_ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const ORGANISATION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SECRET = /^[A-Za-z0-9_-]{32,256}$/;

export function parseIdentityClients(
  clients: string,
  secrets: string,
): { clients: IdentityClient[]; problems: string[] } {
  const problems: string[] = [];
  const secretOf = new Map<string, string>();
  for (const entry of split(secrets, ',')) {
    const at = entry.indexOf('=');
    const id = at < 0 ? '' : entry.slice(0, at).trim();
    const value = at < 0 ? '' : entry.slice(at + 1).trim();
    if (!CLIENT_ID.test(id) || !SECRET.test(value)) {
      problems.push(
        'IDENTITY_SIGN_IN_CLIENT_SECRETS: every entry is client-id=<32+ base64url characters>',
      );
      continue;
    }
    if (secretOf.has(id)) problems.push(`IDENTITY_SIGN_IN_CLIENT_SECRETS: ${id} is listed twice`);
    secretOf.set(id, value);
  }

  const parsed: IdentityClient[] = [];
  const named = new Set<string>();
  const schools = new Set<string>();
  for (const entry of split(clients, ';')) {
    const [school = '', clientId = '', organisation = ''] = entry.split('|').map((p) => p.trim());
    if (!SCHOOL.test(school) || !CLIENT_ID.test(clientId) || !ORGANISATION.test(organisation)) {
      problems.push('IDENTITY_SIGN_IN_CLIENTS: every entry is school-slug|client-id|organisation');
      continue;
    }
    if (schools.has(school)) {
      problems.push(`IDENTITY_SIGN_IN_CLIENTS: school ${school} is listed twice`);
      continue;
    }
    if (named.has(clientId)) {
      problems.push(`IDENTITY_SIGN_IN_CLIENTS: client ${clientId} is listed twice`);
      continue;
    }
    schools.add(school);
    named.add(clientId);
    const secret = secretOf.get(clientId);
    if (secret === undefined) {
      problems.push(`IDENTITY_SIGN_IN_CLIENT_SECRETS: ${clientId} has no secret`);
      continue;
    }
    parsed.push({ school, clientId, organisation, secret });
  }
  for (const id of secretOf.keys()) {
    if (!named.has(id))
      problems.push(`IDENTITY_SIGN_IN_CLIENT_SECRETS: ${id} is not a configured client`);
  }
  return { clients: parsed, problems };
}

const split = (value: string, separator: string): string[] =>
  value
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part !== '');

export interface IdentityKey {
  readonly kid: string;
  readonly publicKey: string;
}

/** `IDENTITY_PUBLIC_KEYS`, the same shape Work reads as PLATFORM_AUTH_PUBLIC_KEYS. */
export function parseIdentityKeys(raw: string): IdentityKey[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('not a non-empty array');
  return parsed.map((entry: unknown) => {
    const e = entry as Record<string, unknown>;
    if (typeof e.kid !== 'string' || typeof e.publicKey !== 'string') {
      throw new Error('each key needs a kid and a publicKey');
    }
    if (/PRIVATE KEY/.test(e.publicKey)) throw new Error('holds a private key');
    createPublicKey(e.publicKey);
    return { kid: e.kid, publicKey: e.publicKey };
  });
}

/** What the browser keeps between the start and the callback (see the binding cookie). */
export interface PendingSignIn {
  readonly state: string;
  readonly nonce: string;
  readonly verifier: string;
  readonly school: string;
}

const token = (): string => randomBytes(32).toString('base64url');

export function beginSignIn(
  issuer: string,
  redirectUri: string,
  client: IdentityClient,
): { url: string; pending: PendingSignIn } {
  const pending: PendingSignIn = {
    state: token(),
    nonce: token(),
    verifier: token(),
    school: client.school,
  };
  const url = new URL(`${issuer.replace(/\/+$/, '')}/api/auth/oidc/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: createHash('sha256').update(pending.verifier).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString();
  return { url: url.toString(), pending };
}

export const tokenEndpoint = (issuer: string): string =>
  `${issuer.replace(/\/+$/, '')}/api/auth/oidc/token`;

export function encodePending(pending: PendingSignIn): string {
  return Buffer.from(JSON.stringify(pending), 'utf8').toString('base64url');
}

export function decodePending(raw: string | undefined): PendingSignIn | null {
  if (raw === undefined || raw === '') return null;
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    const { state, nonce, verifier, school } = value;
    if (
      typeof state !== 'string' ||
      typeof nonce !== 'string' ||
      typeof verifier !== 'string' ||
      typeof school !== 'string'
    ) {
      return null;
    }
    return { state, nonce, verifier, school };
  } catch {
    return null;
  }
}

/**
 * An offer to link an Identity account to a privileged School user, made when that user tried
 * Munaxa sign-in before linking. It is honoured only by the next successful **password** sign-in
 * of the School user with the same email in the same school, so linking a privileged account
 * always proves both: the Identity account (it just signed in) and the School password.
 * Sealed with an HMAC, so the browser that carries it cannot change whom it names.
 */
export interface LinkOffer {
  readonly subject: string;
  readonly email: string;
  readonly school: string;
  /** Seconds since the epoch. */
  readonly expires: number;
}

const mac = (key: Buffer, value: string): string =>
  createHmac('sha256', key).update(value).digest('base64url');

export function sealLinkOffer(offer: LinkOffer, key: Buffer): string {
  const body = Buffer.from(JSON.stringify(offer), 'utf8').toString('base64url');
  return `${body}.${mac(key, body)}`;
}

export function unsealLinkOffer(
  raw: string | undefined,
  key: Buffer,
  now = Math.floor(Date.now() / 1_000),
): LinkOffer | null {
  if (raw === undefined) return null;
  const [body = '', tag = '', ...rest] = raw.split('.');
  if (rest.length > 0 || body === '' || !sameValue(tag, mac(key, body))) return null;
  try {
    const value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    const { subject, email, school, expires } = value;
    if (
      typeof subject !== 'string' ||
      typeof email !== 'string' ||
      typeof school !== 'string' ||
      typeof expires !== 'number' ||
      expires < now
    ) {
      return null;
    }
    return { subject, email, school, expires };
  } catch {
    return null;
  }
}

export const sameValue = (a: string, b: string): boolean => {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right) && a.length === b.length;
};

export interface IdentityClaims {
  readonly subject: string;
  readonly email: string;
}

export type IdTokenCheck =
  | { readonly ok: true; readonly claims: IdentityClaims }
  | { readonly ok: false; readonly reason: string };

/** Clock skew allowed on exp, nbf and iat. */
const SKEW_SECONDS = 60;
/** An id token is redeemed at once; one issued longer ago than this is refused (review L-1). */
const MAX_AGE_SECONDS = 10 * 60;

/**
 * Verifies the id token Identity returned from the token endpoint: ES256 under one of the
 * configured keys, issuer, audience (this school's client), expiry, nonce, a verified email and
 * the organisation the client is bound to.
 */
export function verifyIdToken(
  idToken: string,
  expected: {
    readonly issuer: string;
    readonly client: IdentityClient;
    readonly nonce: string;
    readonly keys: readonly IdentityKey[];
    readonly now?: number;
  },
): IdTokenCheck {
  const parts = idToken.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'MALFORMED' };
  const [encodedHeader = '', encodedBody = '', encodedSignature = ''] = parts;
  let header: Record<string, unknown>;
  let body: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    body = JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }
  if (header.alg !== 'ES256') return { ok: false, reason: 'ALGORITHM' };
  const key = expected.keys.find((k) => k.kid === header.kid);
  if (key === undefined) return { ok: false, reason: 'UNKNOWN_KEY' };
  const verifier = createVerify('SHA256');
  verifier.update(`${encodedHeader}.${encodedBody}`);
  let valid = false;
  try {
    valid = verifier.verify(
      { key: createPublicKey(key.publicKey), dsaEncoding: 'ieee-p1363' },
      Buffer.from(encodedSignature, 'base64url'),
    );
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'SIGNATURE' };

  const now = expected.now ?? Math.floor(Date.now() / 1_000);
  const audience = Array.isArray(body.aud) ? body.aud : [body.aud];
  if (body.iss !== expected.issuer) return { ok: false, reason: 'ISSUER' };
  if (!audience.includes(expected.client.clientId)) return { ok: false, reason: 'AUDIENCE' };
  if (audience.length > 1 && body.azp !== expected.client.clientId) {
    return { ok: false, reason: 'AUDIENCE' };
  }
  if (typeof body.exp !== 'number' || body.exp + SKEW_SECONDS < now) {
    return { ok: false, reason: 'EXPIRED' };
  }
  if (typeof body.nbf === 'number' && body.nbf - SKEW_SECONDS > now) {
    return { ok: false, reason: 'NOT_YET_VALID' };
  }
  if (typeof body.iat !== 'number' || body.iat - SKEW_SECONDS > now) {
    return { ok: false, reason: 'NOT_YET_VALID' };
  }
  if (body.iat + MAX_AGE_SECONDS < now) return { ok: false, reason: 'TOO_OLD' };
  if (typeof body.nonce !== 'string' || !sameValue(body.nonce, expected.nonce)) {
    return { ok: false, reason: 'NONCE' };
  }
  if (body.org !== expected.client.organisation) return { ok: false, reason: 'ORGANISATION' };
  if (typeof body.sub !== 'string' || body.sub === '') return { ok: false, reason: 'SUBJECT' };
  if (
    body.email_verified !== true ||
    typeof body.email !== 'string' ||
    !/^[^@\s]+@[^@\s]+$/.test(body.email)
  ) {
    return { ok: false, reason: 'EMAIL' };
  }
  return { ok: true, claims: { subject: body.sub, email: body.email.toLowerCase() } };
}
