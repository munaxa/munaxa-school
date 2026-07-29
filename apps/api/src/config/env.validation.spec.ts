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
});
