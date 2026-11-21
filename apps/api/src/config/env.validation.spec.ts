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
      SCHOOL_LOCAL_AUTH: 'enabled',
      JWT_ACCESS_SECRET: 'access-secret-at-least-16',
      JWT_REFRESH_SECRET: 'refresh-secret-at-least-16',
      LICENSING_MODE: 'CONTROL_PLANE',
      CONTROL_PLANE_URL: 'https://control.munaxa.test',
      CONTROL_PLANE_TOKEN: 'mxc_test-service-credential',
    };

    it('accepts a fully-configured production environment', () => {
      expect(() => validateEnv(prodBase)).not.toThrow();
    });

    it('requires JWT secrets in production', () => {
      expect(() =>
        validateEnv({ ...base, NODE_ENV: 'production', SCHOOL_LOCAL_AUTH: 'enabled' }),
      ).toThrow(/JWT_ACCESS_SECRET.*required in production/s);
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

  describe('licensing in production', () => {
    const unlicensed = {
      ...base,
      NODE_ENV: 'production',
      SCHOOL_LOCAL_AUTH: 'enabled',
      JWT_ACCESS_SECRET: 'access-secret-at-least-16',
      JWT_REFRESH_SECRET: 'refresh-secret-at-least-16',
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

  describe('sign-in source (SC-07)', () => {
    const publicKey = generateKeyPairSync('ec', { namedCurve: 'P-256' })
      .publicKey.export({ type: 'spki', format: 'pem' })
      .toString();
    const licensed = {
      ...base,
      NODE_ENV: 'production',
      LICENSING_MODE: 'CONTROL_PLANE',
      CONTROL_PLANE_URL: 'https://control.munaxa.test',
      CONTROL_PLANE_TOKEN: 'mxc_test-service-credential',
    };
    const identity = {
      PLATFORM_AUTH_ISSUER: 'https://identity.munaxa.test',
      PLATFORM_AUTH_AUDIENCE: 'munaxa-school',
      PLATFORM_AUTH_ALGORITHM: 'ES256',
      PLATFORM_AUTH_PUBLIC_KEYS: JSON.stringify([{ kid: 'id-1', publicKey }]),
    };

    it('refuses production with neither Identity nor School sign-in named', () => {
      expect(() =>
        validateEnv({
          ...licensed,
          JWT_ACCESS_SECRET: 'access-secret-at-least-16',
          JWT_REFRESH_SECRET: 'refresh-secret-at-least-16',
        }),
      ).toThrow(/SCHOOL_LOCAL_AUTH: production needs Munaxa Identity/);
    });

    it('accepts production on Identity alone, with no JWT secrets', () => {
      const env = validateEnv({ ...licensed, ...identity });
      expect(env.PLATFORM_AUTH_ISSUER).toBe('https://identity.munaxa.test');
      expect(env.SCHOOL_LOCAL_AUTH).toBeUndefined();
    });

    it('still requires JWT secrets when School sign-in is enabled beside Identity', () => {
      expect(() => validateEnv({ ...licensed, ...identity, SCHOOL_LOCAL_AUTH: 'enabled' })).toThrow(
        /JWT_ACCESS_SECRET: required in production/,
      );
    });

    it('refuses a partial Identity configuration in every environment', () => {
      expect(() =>
        validateEnv({ ...base, PLATFORM_AUTH_ISSUER: 'https://identity.munaxa.test' }),
      ).toThrow(/partly configured/);
    });

    it('refuses a symmetric algorithm', () => {
      expect(() => validateEnv({ ...base, ...identity, PLATFORM_AUTH_ALGORITHM: 'HS256' })).toThrow(
        /ES256 only/,
      );
    });

    it('refuses a disabled revocation check in production', () => {
      expect(() =>
        validateEnv({ ...licensed, ...identity, PLATFORM_AUTH_REVOCATION_CHECK: 'disabled' }),
      ).toThrow(/"disabled" is refused in production/);
    });

    it('refuses SCHOOL_LOCAL_AUTH=disabled in production without Identity', () => {
      expect(() => validateEnv({ ...licensed, SCHOOL_LOCAL_AUTH: 'disabled' })).toThrow(
        /production needs Munaxa Identity/,
      );
    });
  });
});
