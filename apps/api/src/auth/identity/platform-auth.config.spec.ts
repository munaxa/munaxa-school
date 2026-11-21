import { generateKeyPairSync } from 'node:crypto';
import {
  readPlatformAuthentication,
  type PlatformAuthenticationSource,
} from './platform-auth.config';

const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const complete: PlatformAuthenticationSource = {
  NODE_ENV: 'production',
  PLATFORM_AUTH_ISSUER: 'https://identity.munaxa.test',
  PLATFORM_AUTH_AUDIENCE: 'munaxa-school, munaxa-school-mobile',
  PLATFORM_AUTH_ALGORITHM: 'ES256',
  PLATFORM_AUTH_PUBLIC_KEYS: JSON.stringify([{ kid: 'id-1', publicKey }]),
};

const issuesOf = (source: PlatformAuthenticationSource): string => {
  const read = readPlatformAuthentication(source);
  return read.kind === 'invalid' ? read.issues.join('\n') : '';
};

describe('readPlatformAuthentication', () => {
  it('is absent when nothing is supplied', () => {
    expect(readPlatformAuthentication({ NODE_ENV: 'production' })).toEqual({ kind: 'absent' });
  });

  it('reads a complete configuration with introspection by default', () => {
    const read = readPlatformAuthentication(complete);
    expect(read.kind).toBe('configured');
    if (read.kind !== 'configured') return;
    expect(read.configuration.audience).toEqual(['munaxa-school', 'munaxa-school-mobile']);
    expect(read.configuration.clockSkewMs).toBe(30_000);
    expect(read.configuration.revocation).toEqual({
      kind: 'introspect',
      url: 'https://identity.munaxa.test/api/auth/introspect',
      cacheMs: 5_000,
      timeoutMs: 2_000,
    });
  });

  it('refuses a partial configuration', () => {
    expect(issuesOf({ ...complete, PLATFORM_AUTH_PUBLIC_KEYS: '' })).toMatch(/partly configured/);
  });

  it.each(['HS256', 'RS256', 'none', 'es256'])('refuses algorithm %s', (algorithm) => {
    expect(issuesOf({ ...complete, PLATFORM_AUTH_ALGORITHM: algorithm })).toMatch(/ES256 only/);
  });

  it('refuses private key material in either field', () => {
    expect(
      issuesOf({
        ...complete,
        PLATFORM_AUTH_PUBLIC_KEYS: JSON.stringify([{ kid: 'a', publicKey: privateKey }]),
      }),
    ).toMatch(/private key/);
    expect(
      issuesOf({
        ...complete,
        PLATFORM_AUTH_PUBLIC_KEYS: JSON.stringify([{ kid: 'a', publicKey, privateKey }]),
      }),
    ).toMatch(/private key material/);
  });

  it('refuses duplicate kids, non-JSON and an empty list', () => {
    expect(
      issuesOf({
        ...complete,
        PLATFORM_AUTH_PUBLIC_KEYS: JSON.stringify([
          { kid: 'a', publicKey },
          { kid: 'a', publicKey },
        ]),
      }),
    ).toMatch(/duplicate kid a/);
    expect(issuesOf({ ...complete, PLATFORM_AUTH_PUBLIC_KEYS: 'nope' })).toMatch(/not valid JSON/);
    expect(issuesOf({ ...complete, PLATFORM_AUTH_PUBLIC_KEYS: '[]' })).toMatch(/at least one key/);
  });

  it('refuses an issuer that is not a URL and an empty audience', () => {
    expect(issuesOf({ ...complete, PLATFORM_AUTH_ISSUER: 'identity' })).toMatch(/not a URL/);
    expect(issuesOf({ ...complete, PLATFORM_AUTH_AUDIENCE: ' , ' })).toMatch(
      /at least one audience/,
    );
  });

  it('allows the revocation check off outside production only', () => {
    const off = { ...complete, PLATFORM_AUTH_REVOCATION_CHECK: 'disabled' };
    expect(issuesOf(off)).toMatch(/refused in production/);
    const dev = readPlatformAuthentication({ ...off, NODE_ENV: 'development' });
    expect(dev.kind === 'configured' && dev.configuration.revocation).toEqual({ kind: 'disabled' });
  });

  it('requires https introspection in production, without credentials', () => {
    expect(
      issuesOf({ ...complete, PLATFORM_AUTH_INTROSPECTION_URL: 'http://identity.munaxa.test/x' }),
    ).toMatch(/must use https in production/);
    expect(
      issuesOf({
        ...complete,
        PLATFORM_AUTH_INTROSPECTION_URL: 'https://u:p@identity.munaxa.test/x',
      }),
    ).toMatch(/no credentials/);
  });
});
