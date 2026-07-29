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

    THROTTLE_TTL: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
  })
  .superRefine((env, ctx) => {
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
