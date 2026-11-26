import { generateKeyPairSync } from 'node:crypto';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  };

  it('applies defaults for optional values', () => {
    const env = validateEnv({ ...base });
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_VERSION).toBe('v1');
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => validateEnv({})).toThrow(/Invalid environment configuration/);
  });

  it('coerces numeric env vars', () => {
    const env = validateEnv({ ...base, PORT: '5000', THROTTLE_LIMIT: '50' });
    expect(env.PORT).toBe(5000);
    expect(env.THROTTLE_LIMIT).toBe(50);
  });

  describe('production guards', () => {
    const prodBase = {
      ...base,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'access-secret-at-least-16',
      JWT_REFRESH_SECRET: 'refresh-secret-at-least-16',
      LICENSING_MODE: 'CONTROL_PLANE',
      CONTROL_PLANE_URL: 'https://control.munaxa.test',
      CONTROL_PLANE_TOKEN: 'mxc_test-service-credential',
      // These guards are about secrets and licensing; staff sign-in is covered below.
      STAFF_PASSWORD_SIGN_IN: 'enabled',
    };

    it('accepts a fully-configured production environment', () => {
      expect(() => validateEnv(prodBase)).not.toThrow();
    });

    it('requires JWT secrets in production', () => {
      expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(
        /JWT_ACCESS_SECRET.*required in production/s,
      );
    });

    it('rejects identical access and refresh secrets in production', () => {
      expect(() =>
        validateEnv({ ...prodBase, JWT_REFRESH_SECRET: prodBase.JWT_ACCESS_SECRET }),
      ).toThrow(/must differ/);
    });

    it('keeps JWT secrets optional outside production', () => {
      expect(() => validateEnv({ ...base, NODE_ENV: 'development' })).not.toThrow();
    });
  });

  describe('staff sign-in', () => {
    const prod = {
      ...base,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'access-secret-at-least-16',
      JWT_REFRESH_SECRET: 'refresh-secret-at-least-16',
      LICENSING_MODE: 'CONTROL_PLANE',
      CONTROL_PLANE_URL: 'https://control.munaxa.test',
      CONTROL_PLANE_TOKEN: 'mxc_test-service-credential',
    };

    it('in production, refuses to leave staff with no way in: Munaxa-only needs Identity', () => {
      expect(() => validateEnv(prod)).toThrow(/IDENTITY_SIGN_IN must be enabled/);
      expect(() => validateEnv({ ...prod, STAFF_PASSWORD_SIGN_IN: 'emergency' })).toThrow(
        /IDENTITY_SIGN_IN must be enabled/,
      );
      expect(() => validateEnv({ ...prod, STAFF_PASSWORD_SIGN_IN: 'enabled' })).not.toThrow();
    });

    it('keeps staff passwords outside production unless told otherwise', () => {
      expect(() => validateEnv(base)).not.toThrow();
      expect(() => validateEnv({ ...base, STAFF_PASSWORD_SIGN_IN: 'disabled' })).toThrow(
        /IDENTITY_SIGN_IN must be enabled/,
      );
    });
  });

  describe('licensing in production', () => {
    const unlicensed = {
      ...base,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'access-secret-at-least-16',
      JWT_REFRESH_SECRET: 'refresh-secret-at-least-16',
      STAFF_PASSWORD_SIGN_IN: 'enabled',
    };
    const publicKey = generateKeyPairSync('ec', { namedCurve: 'P-256' })
      .publicKey.export({ type: 'spki', format: 'pem' })
      .toString();

    it('refuses DATABASE', () => {
      expect(() => validateEnv({ ...unlicensed, LICENSING_MODE: 'DATABASE' })).toThrow(
        /LICENSING_MODE: production needs LICENSE_FILE or CONTROL_PLANE/,
      );
    });

    it('refuses an unset mode, which would default to DATABASE', () => {
      expect(() => validateEnv(unlicensed)).toThrow(
        /LICENSING_MODE: production needs LICENSE_FILE or CONTROL_PLANE/,
      );
    });

    it('accepts a complete licence file configuration', () => {
      const env = validateEnv({
        ...unlicensed,
        LICENSING_MODE: 'LICENSE_FILE',
        LICENSE_FILE_PATH: '/etc/munaxa/school.license',
        LICENSE_PUBLIC_KEYS: JSON.stringify([{ kid: 'lic-1', publicKey }]),
        LICENSE_INSTALLATION_ID: 'install-1',
      });
      expect(env.LICENSING_MODE).toBe('LICENSE_FILE');
    });

    it('still refuses an incomplete licence file configuration', () => {
      expect(() =>
        validateEnv({
          ...unlicensed,
          LICENSING_MODE: 'LICENSE_FILE',
          LICENSE_FILE_PATH: '/etc/munaxa/school.license',
          LICENSE_INSTALLATION_ID: 'install-1',
        }),
      ).toThrow(/LICENSE_PUBLIC_KEYS: required when LICENSING_MODE=LICENSE_FILE/);
    });

    it('accepts an https control plane', () => {
      const env = validateEnv({
        ...unlicensed,
        LICENSING_MODE: 'CONTROL_PLANE',
        CONTROL_PLANE_URL: 'https://control.munaxa.test',
        CONTROL_PLANE_TOKEN: 'mxc_test-service-credential',
      });
      expect(env.LICENSING_MODE).toBe('CONTROL_PLANE');
    });

    it.each(['development', 'test'])('keeps the DATABASE default in %s', (nodeEnv) => {
      expect(validateEnv({ ...base, NODE_ENV: nodeEnv }).LICENSING_MODE).toBe('DATABASE');
    });
  });
  describe('sign in with Munaxa Identity', () => {
    const pem = generateKeyPairSync('ec', { namedCurve: 'P-256' })
      .publicKey.export({ type: 'spki', format: 'pem' })
      .toString();
    const enabled = {
      ...base,
      IDENTITY_SIGN_IN: 'enabled',
      IDENTITY_ISSUER: 'https://id.test.munaxa.com',
      IDENTITY_SIGN_IN_REDIRECT_URI: 'https://school.test.munaxa.com/api/v1/auth/identity/callback',
      IDENTITY_SIGN_IN_CLIENTS: 'al-noor|school-al-noor|al-noor',
      IDENTITY_SIGN_IN_CLIENT_SECRETS: `school-al-noor=${'s'.repeat(40)}`,
      IDENTITY_PUBLIC_KEYS: JSON.stringify([{ kid: 'k1', publicKey: pem }]),
    };

    it('is off by default and needs nothing then', () => {
      expect(validateEnv({ ...base }).IDENTITY_SIGN_IN).toBe('disabled');
    });

    it('accepts a complete configuration', () => {
      expect(validateEnv(enabled).IDENTITY_SIGN_IN).toBe('enabled');
    });

    it('requires every input once enabled', () => {
      expect(() => validateEnv({ ...base, IDENTITY_SIGN_IN: 'enabled' })).toThrow(
        /IDENTITY_ISSUER: required when IDENTITY_SIGN_IN=enabled/,
      );
    });

    it('refuses a client without a secret and a malformed key list', () => {
      expect(() =>
        validateEnv({
          ...enabled,
          IDENTITY_SIGN_IN_CLIENT_SECRETS: `other-client=${'s'.repeat(40)}`,
        }),
      ).toThrow(/school-al-noor has no secret/);
      expect(() => validateEnv({ ...enabled, IDENTITY_PUBLIC_KEYS: '[]' })).toThrow(
        /IDENTITY_PUBLIC_KEYS: is not valid/,
      );
    });

    it('takes a mobile app address that the app owns, and needs the sealing secret', () => {
      const app = { ...enabled, JWT_REFRESH_SECRET: 'r'.repeat(32) };
      expect(
        validateEnv({ ...app, IDENTITY_APP_REDIRECT_URI: 'com.munaxa.teacher://signed-in' })
          .IDENTITY_APP_REDIRECT_URI,
      ).toBe('com.munaxa.teacher://signed-in');
      expect(() => validateEnv({ ...app, IDENTITY_APP_REDIRECT_URI: 'myapp://signed-in' })).toThrow(
        /IDENTITY_APP_REDIRECT_URI/,
      );
      expect(() =>
        validateEnv({
          ...app,
          IDENTITY_APP_REDIRECT_URI: 'https://school.test.munaxa.com/app?x=1',
        }),
      ).toThrow(/IDENTITY_APP_REDIRECT_URI/);
      expect(() =>
        validateEnv({ ...enabled, IDENTITY_APP_REDIRECT_URI: 'com.munaxa.teacher://signed-in' }),
      ).toThrow(/JWT_REFRESH_SECRET: required with IDENTITY_APP_REDIRECT_URI/);
    });

    it('refuses a client secret that is also the JWT secret', () => {
      expect(() => validateEnv({ ...enabled, JWT_ACCESS_SECRET: 's'.repeat(40) })).toThrow(
        /reuses another secret/,
      );
    });
  });
});
