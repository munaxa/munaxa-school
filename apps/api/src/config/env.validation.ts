import { z } from 'zod';

/**
 * Strongly-typed, fail-fast environment validation. The app refuses to boot if required
 * configuration is missing or malformed. Secrets are NEVER hardcoded — only read from env.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    API_GLOBAL_PREFIX: z.string().default('api'),
    API_VERSION: z.string().default('v1'),

    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().optional(),
    // Hybrid tenant-DB routing: JSON `{ "<tenantId>": "<connection url>" }` for siloed schools
    // (own/separate/on-prem database). Unset = every tenant shares the default DB. From secrets.
    TENANT_DATABASE_OVERRIDES: z.string().optional(),
    /** E-invoicing secrets master key (32 bytes, base64) — required only once a tenant enables it. */
    EINVOICE_MASTER_KEY: z.string().optional(),
    /** Set to '0' to disable the e-invoicing submission worker (tests). */
    EINVOICE_WORKER: z.string().optional(),
    /** SMS gateway for fee reminders (no-op until both are set). */
    SMS_PROVIDER: z.string().optional(),
    SMS_API_KEY: z.string().optional(),
    /** Transactional email via Resend (no-op until the key is set). */
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default('Munaxa <no-reply@munaxa.app>'),
    /** Sender for security/account emails (temporary passwords). Per spec: admin@munaxa.com. */
    EMAIL_FROM_ADMIN: z.string().default('Munaxa <admin@munaxa.com>'),
    /** Sender for finance/payment emails (settlement notifications). Dedicated payments mailbox. */
    EMAIL_FROM_FINANCE: z.string().default('Munaxa <payments@mail.munaxa.com>'),
    /**
     * Verified Resend domain used to auto-derive each school's own sender address
     * (`<tenant-slug>@<domain>`) for parent notifications, unless the school overrides it in
     * Notification Settings. One verified domain covers every school's local part.
     */
    EMAIL_SENDER_DOMAIN: z.string().default('mail.munaxa.com'),
    /** '1' enables the HIBP k-anonymity breach check on password set/change (fail-open). */
    PASSWORD_BREACH_CHECK: z.string().optional(),

    CORS_ORIGINS: z.string().default('http://localhost:3000'),

    // JWT (consumed in Phase 3; optional at foundation stage)
    JWT_ACCESS_SECRET: z.string().min(16).optional(),
    JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_SECRET: z.string().min(16).optional(),
    JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),

    SENTRY_DSN: z.string().optional(),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

    /**
     * Where this installation's entitlements come from. `DATABASE` (default): the subscription
     * plane in this database, exactly as before. `LICENSE_FILE`: a signed Munaxa licence on disk,
     * verified offline against the public keys below — for a school running Munaxa on its own
     * server. A licence that is missing or fails verification grants nothing; it never falls back
     * to the database's permissive "no subscription" behaviour. `CONTROL_PLANE`: the central Munaxa
     * subscription service, asked per tenant with this deployment's service credential — for
     * Munaxa-hosted School. A tenant it has no subscription for gets nothing beyond the core
     * modules, never the permissive default.
     */
    LICENSING_MODE: z.enum(['DATABASE', 'LICENSE_FILE', 'CONTROL_PLANE']).default('DATABASE'),
    /** The central service's origin, e.g. `https://control.munaxa.com`. */
    CONTROL_PLANE_URL: z.string().url().optional(),
    /** This deployment's service credential (`mxc_…`), issued in the Super Admin portal. A secret. */
    CONTROL_PLANE_TOKEN: z.string().min(20).optional(),
    LICENSE_FILE_PATH: z.string().min(1).optional(),
    /** JSON `[{"kid":"…","publicKey":"-----BEGIN PUBLIC KEY-----…"}]`. Public keys only. */
    LICENSE_PUBLIC_KEYS: z.string().min(1).optional(),
    LICENSE_ALGORITHM: z.enum(['ES256', 'RS256']).default('ES256'),
    LICENSE_INSTALLATION_ID: z.string().min(1).max(128).optional(),

    THROTTLE_TTL: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
  })
  .superRefine((env, ctx) => {
    // Licensing, in every environment: a mode whose inputs are missing would boot and then
    // refuse every write, which reads as an outage rather than as the misconfiguration it is.
    if (env.LICENSING_MODE === 'LICENSE_FILE') {
      for (const key of [
        'LICENSE_FILE_PATH',
        'LICENSE_PUBLIC_KEYS',
        'LICENSE_INSTALLATION_ID',
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: 'required when LICENSING_MODE=LICENSE_FILE',
          });
        }
      }
      if (env.LICENSE_PUBLIC_KEYS) {
        const problem = publicKeysProblem(env.LICENSE_PUBLIC_KEYS);
        if (problem)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['LICENSE_PUBLIC_KEYS'],
            message: problem,
          });
      }
    }

    if (env.LICENSING_MODE === 'CONTROL_PLANE') {
      for (const key of ['CONTROL_PLANE_URL', 'CONTROL_PLANE_TOKEN'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: 'required when LICENSING_MODE=CONTROL_PLANE',
          });
        }
      }
      // The credential travels in a header: never over plain HTTP outside a developer's machine.
      if (env.NODE_ENV === 'production' && env.CONTROL_PLANE_URL?.startsWith('http://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CONTROL_PLANE_URL'],
          message: 'must be https in production',
        });
      }
    }

    // Production hardening: secrets that are conveniences in dev are mandatory in production.
    if (env.NODE_ENV !== 'production') return;
    if (!env.JWT_ACCESS_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'required in production',
      });
    }
    if (!env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'required in production',
      });
    }
    if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'must differ from JWT_ACCESS_SECRET in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export interface LicensePublicKey {
  kid: string;
  publicKey: string;
}

/** Parses `LICENSE_PUBLIC_KEYS`. Throws on anything that is not a non-empty array of keys. */
export function parseLicensePublicKeys(raw: string): LicensePublicKey[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('not a non-empty array');
  return parsed.map((entry: unknown) => {
    const e = entry as Record<string, unknown>;
    if (typeof e.kid !== 'string' || typeof e.publicKey !== 'string') {
      throw new Error('each key needs a kid and a publicKey');
    }
    return { kid: e.kid, publicKey: e.publicKey };
  });
}

function publicKeysProblem(raw: string): string | null {
  try {
    const keys = parseLicensePublicKeys(raw);
    // An installation holding a private key could sign its own licence.
    if (keys.some((k) => /PRIVATE KEY/.test(k.publicKey))) {
      return 'holds a private key; an installation holds public keys only';
    }
    return null;
  } catch (error) {
    return `is not valid: ${(error as Error).message}`;
  }
}

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
