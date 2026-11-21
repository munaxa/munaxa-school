import { createHmac, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';

/**
 * Test-only helpers (unit and e2e): an ES256 key pair standing in for Identity's signing key, and a minter that
 * produces tokens the way Identity's `TokenService` does (`<b64url header>.<b64url claims>.<sig>`,
 * header `{ alg, typ: 'JWT', kid }`, IEEE P1363 signature). Nothing here is used by the API.
 */
export interface TestSigningKey {
  readonly kid: string;
  readonly privateKey: KeyObject;
  readonly publicKeyPem: string;
}

export const testSigningKey = (kid: string): TestSigningKey => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    kid,
    privateKey,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
};

const segment = (value: unknown): string =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

export const mintEs256 = (
  key: TestSigningKey,
  claims: Record<string, unknown>,
  header: Record<string, unknown> = { alg: 'ES256', typ: 'JWT', kid: key.kid },
): string => {
  const signingInput = `${segment(header)}.${segment(claims)}`;
  const signature = sign('sha256', Buffer.from(signingInput), {
    key: key.privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  return `${signingInput}.${signature}`;
};

/** The algorithm-confusion attack: HS256 "signed" with the verifier's own public key as the secret. */
export const mintHs256WithPublicKey = (
  key: TestSigningKey,
  claims: Record<string, unknown>,
): string => {
  const signingInput = `${segment({ alg: 'HS256', typ: 'JWT', kid: key.kid })}.${segment(claims)}`;
  const signature = createHmac('sha256', key.publicKeyPem).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
};

export const unsignedToken = (key: TestSigningKey, claims: Record<string, unknown>): string =>
  `${segment({ alg: 'none', typ: 'JWT', kid: key.kid })}.${segment(claims)}.`;
