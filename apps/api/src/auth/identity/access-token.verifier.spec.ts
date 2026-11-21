import { generateKeyPairSync } from 'node:crypto';
import {
  mintEs256,
  mintHs256WithPublicKey,
  testSigningKey,
  unsignedToken,
} from '../../../test/identity-keys';
import { AccessTokenRejected, PlatformAccessTokenVerifier } from './access-token.verifier';
import type { PlatformAuthenticationConfiguration } from './platform-auth.config';

const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);
const nowSeconds = Math.floor(NOW / 1000);
const ISSUER = 'https://identity.munaxa.test';

const current = testSigningKey('id-2026-11');
const next = testSigningKey('id-2027-01');
const stranger = testSigningKey('id-2026-11'); // same kid, different key

const configuration = (
  overrides: Partial<PlatformAuthenticationConfiguration> = {},
): PlatformAuthenticationConfiguration => ({
  issuer: ISSUER,
  audience: ['munaxa-school'],
  algorithm: 'ES256',
  keys: [
    { kid: current.kid, publicKey: current.publicKeyPem },
    { kid: next.kid, publicKey: next.publicKeyPem },
  ],
  clockSkewMs: 30_000,
  revocation: { kind: 'disabled' },
  ...overrides,
});

const claims = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sub: 'usr_01',
  tid: 'org_01',
  sid: 'ses_01',
  iss: ISSUER,
  aud: ['munaxa-work', 'munaxa-school'],
  iat: nowSeconds - 60,
  exp: nowSeconds + 840,
  jti: 'jti_01',
  ver: 1,
  perms: ['school:student:manage'],
  ...overrides,
});

const verifier = new PlatformAccessTokenVerifier(configuration(), () => NOW);

const rejection = (token: string, v = verifier): string | undefined => {
  try {
    v.verify(token);
    return undefined;
  } catch (error) {
    return error instanceof AccessTokenRejected ? error.reason : `unexpected: ${String(error)}`;
  }
};

describe('PlatformAccessTokenVerifier', () => {
  it('accepts a token Identity signed for this audience', () => {
    const verified = verifier.verify(mintEs256(current, claims()));
    expect(verified.sub).toBe('usr_01');
    expect(verified.tid).toBe('org_01');
  });

  it('accepts a token signed with a second published key (rotation)', () => {
    expect(rejection(mintEs256(next, claims()))).toBeUndefined();
  });

  describe('algorithm and key', () => {
    it('refuses alg none', () => {
      expect(rejection(unsignedToken(current, claims()))).toBe('algorithm');
    });

    it('refuses HS256 keyed with the public key (algorithm confusion)', () => {
      expect(rejection(mintHs256WithPublicKey(current, claims()))).toBe('algorithm');
    });

    it('refuses an ES256 signature under a header claiming another algorithm', () => {
      const token = mintEs256(current, claims(), { alg: 'RS256', typ: 'JWT', kid: current.kid });
      expect(rejection(token)).toBe('algorithm');
    });

    it('refuses an unknown kid, and a missing one', () => {
      expect(rejection(mintEs256(current, claims(), { alg: 'ES256', kid: 'other' }))).toBe(
        'unknown-key',
      );
      expect(rejection(mintEs256(current, claims(), { alg: 'ES256' }))).toBe('unknown-key');
    });

    it('refuses a token signed by another key under a known kid', () => {
      expect(rejection(mintEs256(stranger, claims()))).toBe('signature');
    });

    it('refuses a token whose claims were changed after signing', () => {
      const [header, , signature] = mintEs256(current, claims()).split('.');
      const forged = Buffer.from(JSON.stringify(claims({ tid: 'org_02' }))).toString('base64url');
      expect(rejection(`${header}.${forged}.${signature}`)).toBe('signature');
    });

    it('refuses malformed tokens', () => {
      expect(rejection('a.b')).toBe('malformed');
      expect(rejection('not-json.not-json.sig')).toBe('malformed');
      expect(rejection('')).toBe('malformed');
    });
  });

  describe('time', () => {
    it('refuses a token with no numeric exp', () => {
      expect(rejection(mintEs256(current, claims({ exp: undefined })))).toBe('expiry');
      expect(rejection(mintEs256(current, claims({ exp: '9999999999' })))).toBe('expiry');
    });

    it('allows the configured skew past exp, and no more', () => {
      expect(rejection(mintEs256(current, claims({ exp: nowSeconds - 20 })))).toBeUndefined();
      expect(rejection(mintEs256(current, claims({ exp: nowSeconds - 31 })))).toBe('expired');
    });

    it('refuses a token issued in the future beyond the skew', () => {
      expect(rejection(mintEs256(current, claims({ iat: nowSeconds + 60 })))).toBe(
        'issued-in-future',
      );
      expect(rejection(mintEs256(current, claims({ iat: nowSeconds + 10 })))).toBeUndefined();
    });

    it('refuses a token not yet valid (nbf) beyond the skew', () => {
      expect(rejection(mintEs256(current, claims({ nbf: nowSeconds + 60 })))).toBe('not-yet-valid');
      expect(rejection(mintEs256(current, claims({ nbf: nowSeconds })))).toBeUndefined();
    });
  });

  describe('issuer and audience', () => {
    it('requires the issuer exactly', () => {
      expect(rejection(mintEs256(current, claims({ iss: `${ISSUER}/` })))).toBe('issuer');
      expect(rejection(mintEs256(current, claims({ iss: 'https://evil.test' })))).toBe('issuer');
    });

    it('requires an overlapping audience', () => {
      expect(rejection(mintEs256(current, claims({ aud: ['munaxa-work'] })))).toBe('audience');
      expect(rejection(mintEs256(current, claims({ aud: undefined })))).toBe('audience');
    });

    it('reads a string aud as one audience, never as a substring', () => {
      expect(rejection(mintEs256(current, claims({ aud: 'munaxa-school' })))).toBeUndefined();
      expect(rejection(mintEs256(current, claims({ aud: 'munaxa-school-other' })))).toBe(
        'audience',
      );
    });
  });

  it('refuses a key that is not P-256 at construction', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
      .publicKey.export({ type: 'spki', format: 'pem' })
      .toString();
    expect(
      () =>
        new PlatformAccessTokenVerifier(configuration({ keys: [{ kid: 'rsa', publicKey: rsa }] })),
    ).toThrow(/not a P-256 public key/);
  });

  it('never quotes the token in a rejection', () => {
    const token = mintEs256(current, claims({ iss: 'https://evil.test' }));
    try {
      verifier.verify(token);
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(token);
    }
  });

  it('reads the header algorithm for routing only', () => {
    expect(PlatformAccessTokenVerifier.headerAlgorithm(mintEs256(current, claims()))).toBe('ES256');
    expect(PlatformAccessTokenVerifier.headerAlgorithm('garbage')).toBeUndefined();
  });
});
