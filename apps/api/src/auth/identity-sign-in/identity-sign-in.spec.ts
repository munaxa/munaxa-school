import { createHash, createSign, generateKeyPairSync } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  beginSignIn,
  decodePending,
  encodePending,
  parseIdentityClients,
  parseIdentityKeys,
  verifyIdToken,
  type IdentityClient,
} from './identity-sign-in';
import { IdentitySignInService } from './identity-sign-in.service';

const ISSUER = 'https://id.test.munaxa.com';
const REDIRECT = 'https://school.test.munaxa.com/api/v1/auth/identity/callback';
const SECRET = 'a'.repeat(40);
const CLIENT: IdentityClient = {
  school: 'al-noor',
  clientId: 'school-al-noor',
  organisation: 'al-noor',
  secret: SECRET,
};

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const KEYS = [{ kid: 'k1', publicKey: PUBLIC_PEM }];

const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');

function idToken(
  claims: Record<string, unknown>,
  header: Record<string, unknown> = { alg: 'ES256', typ: 'JWT', kid: 'k1' },
  key = privateKey,
): string {
  const now = Math.floor(Date.now() / 1_000);
  const body = {
    iss: ISSUER,
    sub: 'identity-user-1',
    aud: 'school-al-noor',
    exp: now + 300,
    iat: now,
    nbf: now,
    nonce: 'the-nonce',
    email: 'Teacher@AlNoor.example',
    email_verified: true,
    org: 'al-noor',
    ...claims,
  };
  const input = `${b64(header)}.${b64(body)}`;
  const signature = createSign('SHA256')
    .update(input)
    .sign({ key, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  return `${input}.${signature}`;
}

const expected = { issuer: ISSUER, client: CLIENT, nonce: 'the-nonce', keys: KEYS };

describe('parseIdentityClients', () => {
  it('pairs each school with its client, organisation and secret', () => {
    expect(
      parseIdentityClients('al-noor|school-al-noor|al-noor', `school-al-noor=${SECRET}`),
    ).toEqual({ clients: [CLIENT], problems: [] });
  });

  it('reports a client with no secret, a secret with no client, and duplicates', () => {
    const { clients, problems } = parseIdentityClients(
      'al-noor|school-al-noor|al-noor;al-noor|school-other|other;x|bad id|org',
      `school-orphan=${SECRET},short=abc`,
    );
    expect(clients).toEqual([]);
    expect(problems).toEqual(
      expect.arrayContaining([
        'IDENTITY_SIGN_IN_CLIENT_SECRETS: school-al-noor has no secret',
        'IDENTITY_SIGN_IN_CLIENTS: school al-noor is listed twice',
        'IDENTITY_SIGN_IN_CLIENTS: every entry is school-slug|client-id|organisation',
        'IDENTITY_SIGN_IN_CLIENT_SECRETS: school-orphan is not a configured client',
        'IDENTITY_SIGN_IN_CLIENT_SECRETS: every entry is client-id=<32+ base64url characters>',
      ]),
    );
  });
});

describe('parseIdentityKeys', () => {
  it('accepts public keys and refuses a private one', () => {
    expect(parseIdentityKeys(JSON.stringify(KEYS))).toEqual(KEYS);
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    expect(() => parseIdentityKeys(JSON.stringify([{ kid: 'k', publicKey: pem }]))).toThrow(
      /private key/,
    );
  });
});

describe('beginSignIn', () => {
  it('asks Identity for a code with state, nonce and an S256 PKCE challenge', () => {
    const { url, pending } = beginSignIn(`${ISSUER}/`, REDIRECT, CLIENT);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(`${ISSUER}/api/auth/oidc/authorize`);
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'school-al-noor',
      redirect_uri: REDIRECT,
      scope: 'openid email profile',
      state: pending.state,
      nonce: pending.nonce,
      code_challenge: createHash('sha256').update(pending.verifier).digest('base64url'),
      code_challenge_method: 'S256',
    });
    expect(new Set([pending.state, pending.nonce, pending.verifier]).size).toBe(3);
    expect(pending.school).toBe('al-noor');
  });

  it('round-trips the pending sign-in through the cookie value and refuses junk', () => {
    const { pending } = beginSignIn(ISSUER, REDIRECT, CLIENT);
    expect(decodePending(encodePending(pending))).toEqual(pending);
    expect(decodePending('not-json')).toBeNull();
    expect(decodePending(undefined)).toBeNull();
  });
});

describe('verifyIdToken', () => {
  it('accepts a token Identity signed for this school, with the email lower-cased', () => {
    expect(verifyIdToken(idToken({}), expected)).toEqual({
      ok: true,
      claims: { subject: 'identity-user-1', email: 'teacher@alnoor.example', mfa: false },
    });
  });

  it('reports a sign-in Identity says used a second factor', () => {
    const checked = verifyIdToken(idToken({ acr: 'mfa' }), expected);
    expect(checked.ok && checked.claims.mfa).toBe(true);
  });

  it.each([
    ['another issuer', { iss: 'https://evil.example' }, 'ISSUER'],
    ['another client', { aud: 'docs-al-noor' }, 'AUDIENCE'],
    ['an expired token', { exp: Math.floor(Date.now() / 1_000) - 3_600 }, 'EXPIRED'],
    ['another nonce', { nonce: 'replayed' }, 'NONCE'],
    ['another organisation', { org: 'other-school' }, 'ORGANISATION'],
    ['an unverified email', { email_verified: false }, 'EMAIL'],
    ['no subject', { sub: '' }, 'SUBJECT'],
    ['a token issued long ago', { iat: Math.floor(Date.now() / 1_000) - 3_600 }, 'TOO_OLD'],
    ['a token without iat', { iat: undefined }, 'NOT_YET_VALID'],
  ])('refuses %s', (_name, claims, reason) => {
    expect(verifyIdToken(idToken(claims), expected)).toEqual({ ok: false, reason });
  });

  it('refuses another algorithm, an unknown key and a forged signature', () => {
    expect(verifyIdToken(idToken({}, { alg: 'HS256', kid: 'k1' }), expected)).toEqual({
      ok: false,
      reason: 'ALGORITHM',
    });
    expect(verifyIdToken(idToken({}, { alg: 'ES256', kid: 'k9' }), expected)).toEqual({
      ok: false,
      reason: 'UNKNOWN_KEY',
    });
    const other = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
    expect(
      verifyIdToken(idToken({}, { alg: 'ES256', typ: 'JWT', kid: 'k1' }, other), expected),
    ).toEqual({ ok: false, reason: 'SIGNATURE' });
    expect(verifyIdToken('a.b', expected)).toEqual({ ok: false, reason: 'MALFORMED' });
  });
});

describe('IdentitySignInService', () => {
  const config = (values: Record<string, string>) =>
    new ConfigService({
      IDENTITY_SIGN_IN: 'enabled',
      IDENTITY_ISSUER: ISSUER,
      IDENTITY_SIGN_IN_REDIRECT_URI: REDIRECT,
      IDENTITY_SIGN_IN_CLIENTS: 'al-noor|school-al-noor|al-noor',
      IDENTITY_SIGN_IN_CLIENT_SECRETS: `school-al-noor=${SECRET}`,
      IDENTITY_PUBLIC_KEYS: JSON.stringify(KEYS),
      ...values,
    });
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('offers nothing when switched off, and only configured schools when on', () => {
    expect(
      new IdentitySignInService(config({ IDENTITY_SIGN_IN: 'disabled' })).offers('al-noor'),
    ).toBe(false);
    const service = new IdentitySignInService(config({}));
    expect(service.offers('AL-NOOR')).toBe(true);
    expect(service.start('other')).toBeNull();
  });

  it('redeems the code with the verifier and the client secret, then verifies the id token', async () => {
    const service = new IdentitySignInService(config({}));
    const { pending } = service.start('al-noor')!;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: idToken({ nonce: pending.nonce }) }),
    });
    global.fetch = fetchMock;

    const result = await service.complete(pending, { code: 'the-code', state: pending.state });

    expect(result).toEqual({
      ok: true,
      school: 'al-noor',
      claims: { subject: 'identity-user-1', email: 'teacher@alnoor.example', mfa: false },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ISSUER}/api/auth/oidc/token`);
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({
      grant_type: 'authorization_code',
      code: 'the-code',
      redirect_uri: REDIRECT,
      client_id: 'school-al-noor',
      client_secret: SECRET,
      code_verifier: pending.verifier,
    });
  });

  it('refuses a callback this browser did not start, without calling Identity', async () => {
    const service = new IdentitySignInService(config({}));
    const { pending } = service.start('al-noor')!;
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    expect(await service.complete(pending, { code: 'c', state: 'attacker-state' })).toEqual({
      ok: false,
      reason: 'STATE',
    });
    expect(await service.complete(null, { code: 'c', state: pending.state })).toEqual({
      ok: false,
      reason: 'NO_BINDING',
    });
    expect(
      await service.complete(pending, { error: 'access_denied', state: pending.state }),
    ).toEqual({ ok: false, reason: 'PROVIDER_ERROR' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when Identity refuses or cannot be reached', async () => {
    const service = new IdentitySignInService(config({}));
    const { pending } = service.start('al-noor')!;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'invalid_grant' }),
    });
    expect(await service.complete(pending, { code: 'c', state: pending.state })).toEqual({
      ok: false,
      reason: 'TOKEN_REFUSED',
    });
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    expect(await service.complete(pending, { code: 'c', state: pending.state })).toEqual({
      ok: false,
      reason: 'UNAVAILABLE',
    });
  });
});
