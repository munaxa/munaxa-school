import { createPublicKey, verify as verifySignature, type KeyObject } from 'node:crypto';
import type { PlatformAuthenticationConfiguration } from './platform-auth.config';

/**
 * Verifies a Munaxa Identity access token (SC-07).
 *
 * Munaxa Work verifies these with `@munaxa/auth`'s `TokenService` over `@munaxa/crypto`'s
 * `AsymmetricSigner`. School does not depend on `@munaxa/auth` (it is not in School's lockfile, and
 * School's CI installs only the @munaxa packages already granted to it), so this is the same check
 * written against `node:crypto`, rule for rule:
 *
 * - **Algorithm.** ES256 only, from configuration. The header's `alg` must also say `ES256`; the
 *   header is otherwise trusted for nothing but the key id, so `alg: none`, `HS256` with the public
 *   key as an HMAC secret, and every other algorithm-confusion token is refused.
 * - **Key.** Selected by the header's `kid` from the configured ring. An unknown or missing `kid`
 *   is refused; there is no "try every key" fallback.
 * - **Signature.** ECDSA P-256 / SHA-256 over `<header>.<payload>`, IEEE P1363 encoding (JWS).
 * - **Time.** `exp` is required and must be a finite number; expired when
 *   `exp * 1000 + skew < now`. `iat`, when present, must be finite and not later than
 *   `now + skew`. `nbf`, when present, likewise (Identity does not mint it today).
 * - **Issuer.** `iss` must equal the configured issuer exactly.
 * - **Audience.** At least one configured audience must appear in `aud` (a string is read as a
 *   one-element list, so a substring never matches).
 *
 * Every rejection throws `AccessTokenRejected` with a reason code and never the token.
 */

export type AccessTokenRejection =
  | 'malformed'
  | 'algorithm'
  | 'unknown-key'
  | 'signature'
  | 'expiry'
  | 'expired'
  | 'issued-in-future'
  | 'not-yet-valid'
  | 'issuer'
  | 'audience';

export class AccessTokenRejected extends Error {
  constructor(readonly reason: AccessTokenRejection) {
    super(`Access token rejected: ${reason}`);
    this.name = 'AccessTokenRejected';
  }
}

/** The claims as Identity signed them. Shapes beyond `exp`/`iat`/`nbf`/`iss`/`aud` are the caller's to check. */
export type VerifiedClaims = Readonly<Record<string, unknown>> & {
  readonly exp: number;
  readonly iss: string;
};

const BASE64URL = /^[A-Za-z0-9_-]*$/;

const decodeSegment = (segment: string): unknown => {
  if (!BASE64URL.test(segment)) throw new AccessTokenRejected('malformed');
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    throw new AccessTokenRejected('malformed');
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export class PlatformAccessTokenVerifier {
  private readonly keys = new Map<string, KeyObject>();

  constructor(
    private readonly configuration: PlatformAuthenticationConfiguration,
    private readonly now: () => number = Date.now,
  ) {
    for (const key of configuration.keys) {
      const publicKey = createPublicKey(key.publicKey);
      // An ES256 verifier holding an RSA or a P-384 key would refuse everything; say so at boot.
      if (
        publicKey.asymmetricKeyType !== 'ec' ||
        publicKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
      ) {
        throw new Error(
          `PLATFORM_AUTH_PUBLIC_KEYS: key "${key.kid}" is not a P-256 public key (ES256).`,
        );
      }
      this.keys.set(key.kid, publicKey);
    }
  }

  verify(token: string): VerifiedClaims {
    const parts = token.split('.');
    if (parts.length !== 3) throw new AccessTokenRejected('malformed');
    const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];

    const header = decodeSegment(encodedHeader);
    const claims = decodeSegment(encodedPayload);
    if (!isRecord(header) || !isRecord(claims)) throw new AccessTokenRejected('malformed');

    if (header.alg !== this.configuration.algorithm) throw new AccessTokenRejected('algorithm');
    const key = typeof header.kid === 'string' ? this.keys.get(header.kid) : undefined;
    if (key === undefined) throw new AccessTokenRejected('unknown-key');

    if (!BASE64URL.test(encodedSignature)) throw new AccessTokenRejected('malformed');
    let valid = false;
    try {
      valid = verifySignature(
        'sha256',
        Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8'),
        { key, dsaEncoding: 'ieee-p1363' },
        Buffer.from(encodedSignature, 'base64url'),
      );
    } catch {
      valid = false;
    }
    if (!valid) throw new AccessTokenRejected('signature');

    if (!isFiniteNumber(claims.exp)) throw new AccessTokenRejected('expiry');
    if (claims.iat !== undefined && !isFiniteNumber(claims.iat)) {
      throw new AccessTokenRejected('malformed');
    }
    if (claims.nbf !== undefined && !isFiniteNumber(claims.nbf)) {
      throw new AccessTokenRejected('malformed');
    }

    const now = this.now();
    const skew = this.configuration.clockSkewMs;
    if (claims.exp * 1_000 + skew < now) throw new AccessTokenRejected('expired');
    if (isFiniteNumber(claims.iat) && claims.iat * 1_000 - skew > now) {
      throw new AccessTokenRejected('issued-in-future');
    }
    if (isFiniteNumber(claims.nbf) && claims.nbf * 1_000 - skew > now) {
      throw new AccessTokenRejected('not-yet-valid');
    }

    if (claims.iss !== this.configuration.issuer) throw new AccessTokenRejected('issuer');

    const raw = claims.aud;
    const actual: readonly unknown[] =
      typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : [];
    if (!this.configuration.audience.some((entry) => actual.includes(entry))) {
      throw new AccessTokenRejected('audience');
    }

    return claims as VerifiedClaims;
  }

  /** The algorithm a token's header names, unverified. Used to route a token, never to accept one. */
  static headerAlgorithm(token: string): string | undefined {
    const encodedHeader = token.split('.')[0] ?? '';
    try {
      const header = decodeSegment(encodedHeader);
      return isRecord(header) && typeof header.alg === 'string' ? header.alg : undefined;
    } catch {
      return undefined;
    }
  }
}
