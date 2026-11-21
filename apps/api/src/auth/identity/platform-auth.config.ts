/**
 * The Munaxa Identity verification contract, as a deployment configured it (SC-07).
 *
 * School verifies access tokens that Munaxa Identity issued; it never issues one. To verify it needs
 * four things: the issuer to trust, the audience it is, the signature algorithm and the public keys.
 * This is a port of munaxa-work's `packages/config/src/platform-authentication.ts`, with the same
 * three load-bearing properties:
 *
 * - **All four or none.** A half-configured deployment fails startup rather than quietly
 *   verifying nothing while the operator believes it verifies tokens.
 * - **Asymmetric only, and ES256 only.** Identity signs with ES256 (its `IDENTITY_SIGNING_ALGORITHMS`
 *   is `['ES256']`). A symmetric algorithm would give School the key that mints what it accepts.
 * - **Public key material only.** An entry carrying a private key is refused, not ignored.
 *
 * Pure: it decides, and the caller acts. Env validation calls it to fail boot on `invalid`; the
 * authentication service calls it again to build the verifier, so the check and the use agree.
 */

/** The only algorithm School verifies Identity tokens with. */
export const PLATFORM_AUTHENTICATION_ALGORITHMS = ['ES256'] as const;
export type PlatformAuthenticationAlgorithm = (typeof PLATFORM_AUTHENTICATION_ALGORITHMS)[number];

export interface PlatformVerificationKey {
  readonly kid: string;
  readonly publicKey: string;
}

/**
 * How a verified token is held to Identity's live session state (munaxa-work WK-02).
 * `introspect` asks Identity's `GET /api/auth/introspect` and reuses a positive answer for at most
 * `cacheMs`; `disabled` accepts a signed-out token until it expires and is refused in production.
 */
export type PlatformRevocationCheck =
  | {
      readonly kind: 'introspect';
      readonly url: string;
      readonly cacheMs: number;
      readonly timeoutMs: number;
    }
  | { readonly kind: 'disabled' };

export interface PlatformAuthenticationConfiguration {
  readonly issuer: string;
  readonly audience: readonly string[];
  readonly algorithm: PlatformAuthenticationAlgorithm;
  readonly keys: readonly PlatformVerificationKey[];
  readonly clockSkewMs: number;
  readonly revocation: PlatformRevocationCheck;
}

export interface PlatformAuthenticationSource {
  readonly NODE_ENV?: string | undefined;
  readonly PLATFORM_AUTH_ISSUER?: string | undefined;
  readonly PLATFORM_AUTH_AUDIENCE?: string | undefined;
  readonly PLATFORM_AUTH_ALGORITHM?: string | undefined;
  readonly PLATFORM_AUTH_PUBLIC_KEYS?: string | undefined;
  readonly PLATFORM_AUTH_CLOCK_SKEW_MS?: number | undefined;
  readonly PLATFORM_AUTH_REVOCATION_CHECK?: string | undefined;
  readonly PLATFORM_AUTH_INTROSPECTION_URL?: string | undefined;
  readonly PLATFORM_AUTH_REVOCATION_CACHE_MS?: number | undefined;
  readonly PLATFORM_AUTH_INTROSPECTION_TIMEOUT_MS?: number | undefined;
}

export type PlatformAuthentication =
  | { readonly kind: 'absent' }
  | { readonly kind: 'configured'; readonly configuration: PlatformAuthenticationConfiguration }
  | { readonly kind: 'invalid'; readonly issues: readonly string[] };

/** Identity serves every route under `/api/auth`. */
const INTROSPECTION_PATH = '/api/auth/introspect';
export const DEFAULT_CLOCK_SKEW_MS = 30_000;
const DEFAULT_REVOCATION_CACHE_MS = 5_000;
const MAX_REVOCATION_CACHE_MS = 30_000;
const DEFAULT_INTROSPECTION_TIMEOUT_MS = 2_000;

const REQUIRED_VARIABLES = [
  'PLATFORM_AUTH_ISSUER',
  'PLATFORM_AUTH_AUDIENCE',
  'PLATFORM_AUTH_ALGORITHM',
  'PLATFORM_AUTH_PUBLIC_KEYS',
] as const;

const PRIVATE_KEY_PEM = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const PUBLIC_KEY_PEM = /^-----BEGIN (RSA )?PUBLIC KEY-----/;

const isSupplied = (value: string | undefined): boolean =>
  value !== undefined && value.trim() !== '';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const splitList = (raw: string): readonly string[] =>
  raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

const readKey = (
  entry: unknown,
  index: number,
): { readonly key?: PlatformVerificationKey; readonly issues: readonly string[] } => {
  const at = `PLATFORM_AUTH_PUBLIC_KEYS[${index}]`;
  if (!isRecord(entry)) return { issues: [`${at}: must be an object with "kid" and "publicKey".`] };
  if ('privateKey' in entry) {
    return {
      issues: [
        `${at}: carries private key material. Munaxa School verifies tokens and never signs one; give it the public key alone.`,
      ],
    };
  }
  const { kid, publicKey } = entry;
  if (typeof kid !== 'string' || kid.trim() === '') {
    return { issues: [`${at}: "kid" must be a non-empty string; it is what selects the key.`] };
  }
  if (typeof publicKey !== 'string' || publicKey.trim() === '') {
    return { issues: [`${at}: "publicKey" must be a non-empty PEM string.`] };
  }
  const pem = publicKey.trim();
  if (PRIVATE_KEY_PEM.test(pem)) {
    return {
      issues: [
        `${at}: "publicKey" contains a PEM private key. Supply the public half; a deployment that can sign can forge what it verifies.`,
      ],
    };
  }
  if (!PUBLIC_KEY_PEM.test(pem)) return { issues: [`${at}: "publicKey" is not a PEM public key.`] };
  return { key: { kid: kid.trim(), publicKey: pem }, issues: [] };
};

const readKeys = (
  raw: string,
): { readonly keys: readonly PlatformVerificationKey[]; readonly issues: readonly string[] } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      keys: [],
      issues: [
        'PLATFORM_AUTH_PUBLIC_KEYS: not valid JSON. Expected [{"kid":"…","publicKey":"-----BEGIN PUBLIC KEY-----…"}].',
      ],
    };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {
      keys: [],
      issues: ['PLATFORM_AUTH_PUBLIC_KEYS: must be a JSON array holding at least one key.'],
    };
  }
  const read = parsed.map(readKey);
  const keys = read.flatMap((entry) => (entry.key === undefined ? [] : [entry.key]));
  const kids = keys.map((key) => key.kid);
  const duplicated = [...new Set(kids.filter((kid, index) => kids.indexOf(kid) !== index))];
  return {
    keys,
    issues: [
      ...read.flatMap((entry) => entry.issues),
      ...(duplicated.length === 0
        ? []
        : [
            `PLATFORM_AUTH_PUBLIC_KEYS: duplicate kid ${duplicated.join(', ')}; each key needs its own.`,
          ]),
    ],
  };
};

const issuerIssues = (raw: string): readonly string[] => {
  try {
    new URL(raw);
    return [];
  } catch {
    return [
      `PLATFORM_AUTH_ISSUER: "${raw}" is not a URL. It must equal the "iss" claim Identity mints, exactly.`,
    ];
  }
};

const algorithmIssues = (raw: string): readonly string[] =>
  (PLATFORM_AUTHENTICATION_ALGORITHMS as readonly string[]).includes(raw)
    ? []
    : [
        `PLATFORM_AUTH_ALGORITHM: "${raw}" is not accepted. Munaxa School verifies Identity tokens with ES256 only.`,
      ];

type RevocationReading = {
  readonly check?: PlatformRevocationCheck;
  readonly issues: readonly string[];
};

const refused = (issue: string): RevocationReading => ({ issues: [issue] });

const introspectionUrl = (
  configured: string | undefined,
  issuer: string,
  production: boolean,
): string | RevocationReading => {
  const trimmed = configured?.trim() ?? '';
  const raw = trimmed === '' ? `${issuer.replace(/\/+$/, '')}${INTROSPECTION_PATH}` : trimmed;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return refused(`PLATFORM_AUTH_INTROSPECTION_URL: "${raw}" is not a URL.`);
  }
  const secure = url.protocol === 'https:' || (url.protocol === 'http:' && !production);
  if (!secure) {
    return refused(
      `PLATFORM_AUTH_INTROSPECTION_URL: must use https${production ? ' in production' : ' or http'}; the access token is sent to it.`,
    );
  }
  if (url.username !== '' || url.password !== '' || url.hash !== '') {
    return refused('PLATFORM_AUTH_INTROSPECTION_URL: must carry no credentials and no fragment.');
  }
  return url.toString();
};

const readRevocationCheck = (
  source: PlatformAuthenticationSource,
  issuer: string,
): RevocationReading => {
  const production = source.NODE_ENV === 'production';
  const mode = (source.PLATFORM_AUTH_REVOCATION_CHECK ?? 'introspect').trim();
  if (mode === 'disabled') {
    return production
      ? refused(
          'PLATFORM_AUTH_REVOCATION_CHECK: "disabled" is refused in production. Without it a signed-out or revoked session keeps working until its access token expires.',
        )
      : { check: { kind: 'disabled' }, issues: [] };
  }
  if (mode !== 'introspect') {
    return refused(
      `PLATFORM_AUTH_REVOCATION_CHECK: "${mode}" is not accepted. Use "introspect" (or "disabled" outside production).`,
    );
  }
  const url = introspectionUrl(source.PLATFORM_AUTH_INTROSPECTION_URL, issuer, production);
  if (typeof url !== 'string') return url;
  const cacheMs = source.PLATFORM_AUTH_REVOCATION_CACHE_MS ?? DEFAULT_REVOCATION_CACHE_MS;
  if (!Number.isInteger(cacheMs) || cacheMs < 0 || cacheMs > MAX_REVOCATION_CACHE_MS) {
    return refused(
      `PLATFORM_AUTH_REVOCATION_CACHE_MS: must be a whole number from 0 to ${String(MAX_REVOCATION_CACHE_MS)}.`,
    );
  }
  return {
    check: {
      kind: 'introspect',
      url,
      cacheMs,
      timeoutMs: source.PLATFORM_AUTH_INTROSPECTION_TIMEOUT_MS ?? DEFAULT_INTROSPECTION_TIMEOUT_MS,
    },
    issues: [],
  };
};

/** Reads the Identity verification contract. Never throws. */
export const readPlatformAuthentication = (
  source: PlatformAuthenticationSource,
): PlatformAuthentication => {
  const supplied = REQUIRED_VARIABLES.filter((name) => isSupplied(source[name]));
  if (supplied.length === 0) return { kind: 'absent' };
  if (supplied.length < REQUIRED_VARIABLES.length) {
    const missing = REQUIRED_VARIABLES.filter((name) => !supplied.includes(name));
    return {
      kind: 'invalid',
      issues: [
        `Identity verification is partly configured: ${supplied.join(', ')} supplied, ${missing.join(', ')} missing. Supply all four or none.`,
      ],
    };
  }

  const issuer = (source.PLATFORM_AUTH_ISSUER ?? '').trim();
  const algorithm = (source.PLATFORM_AUTH_ALGORITHM ?? '').trim();
  const audience = splitList(source.PLATFORM_AUTH_AUDIENCE ?? '');
  const keyMaterial = readKeys((source.PLATFORM_AUTH_PUBLIC_KEYS ?? '').trim());
  const issues = [
    ...issuerIssues(issuer),
    ...(audience.length === 0
      ? ['PLATFORM_AUTH_AUDIENCE: must name at least one audience this deployment answers to.']
      : []),
    ...algorithmIssues(algorithm),
    ...keyMaterial.issues,
  ];
  if (issues.length > 0) return { kind: 'invalid', issues };

  const revocation = readRevocationCheck(source, issuer);
  if (revocation.check === undefined) return { kind: 'invalid', issues: revocation.issues };

  return {
    kind: 'configured',
    configuration: Object.freeze({
      issuer,
      audience,
      algorithm: algorithm as PlatformAuthenticationAlgorithm,
      keys: keyMaterial.keys,
      clockSkewMs: source.PLATFORM_AUTH_CLOCK_SKEW_MS ?? DEFAULT_CLOCK_SKEW_MS,
      revocation: revocation.check,
    }),
  };
};
