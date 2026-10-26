import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { AsymmetricSigner } from '@munaxa/crypto';
import { armorLicense, issueLicense, type LicensePayload } from '@munaxa/licensing';
import { PlanFeature } from '@school/domain';
import type { Env } from '../config/env.validation';
import { validateEnv } from '../config/env.validation';
import { LicenceSource } from './licence.source';
import { SubscriptionService } from './subscription.service';
import type { SubscriptionRepository } from './subscription.repository';

const TENANT = '0d1f4c9e-0000-4000-8000-000000000001';
const directory = mkdtempSync(join(tmpdir(), 'school-licence-'));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pair = {
  kid: 'lic-1',
  privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
};
const issuer = new AsymmetricSigner('ES256', [pair]);
const path = join(directory, 'school.license');

function licence(overrides: Partial<LicensePayload> = {}): string {
  return armorLicense(
    issueLicense(
      {
        schemaVersion: 1,
        customerId: 'cus_1',
        tenantId: TENANT,
        product: 'school',
        deployment: 'ON_PREMISES',
        subscriptionId: 'sub_1',
        plan: { code: 'professional', version: 1 },
        status: 'ACTIVE',
        trialEndsAt: null,
        expiresAt: '2099-01-01T00:00:00.000Z',
        graceUntil: null,
        features: [PlanFeature.ADVANCED_REPORTS],
        limits: { students: 1500, campuses: 5, staff: null },
        licenseId: 'lic_1',
        installationId: 'inst-1',
        issuedAt: '2026-01-01T00:00:00.000Z',
        notBefore: '2026-01-01T00:00:00.000Z',
        supersedes: null,
        ...overrides,
      },
      issuer,
    ),
  );
}

const env = {
  DATABASE_URL: 'postgresql://app@localhost:5432/school',
  LICENSING_MODE: 'LICENSE_FILE',
  LICENSE_FILE_PATH: path,
  LICENSE_PUBLIC_KEYS: JSON.stringify([{ kid: pair.kid, publicKey: pair.publicKey }]),
  LICENSE_INSTALLATION_ID: 'inst-1',
};

function configOf(values: Record<string, unknown>): ConfigService<Env, true> {
  const parsed = validateEnv(values);
  return { get: (key: keyof Env) => parsed[key] } as unknown as ConfigService<Env, true>;
}

/** A repository that must never be asked: on premises the licence is the only authority. */
const untouchable = new Proxy({} as SubscriptionRepository, {
  get: () => () => {
    throw new Error('the database plane was consulted in licence mode');
  },
});

function service(): SubscriptionService {
  return new SubscriptionService(untouchable, new LicenceSource(configOf(env)));
}

describe('LicenceSource and SubscriptionService on premises', () => {
  it('in DATABASE mode the licence defers to the subscription plane', async () => {
    const source = new LicenceSource(configOf({ DATABASE_URL: env.DATABASE_URL }));
    await expect(source.current(TENANT)).resolves.toEqual({ configured: false });
  });

  it('a valid licence decides features, limits and writes', async () => {
    writeFileSync(path, licence());
    const s = service();
    await expect(s.canUseFeature(TENANT, PlanFeature.ADVANCED_REPORTS)).resolves.toBe(true);
    await expect(s.canUseFeature(TENANT, PlanFeature.SSO)).resolves.toBe(false);
    // Core modules are never gated, licence or not.
    await expect(s.canUseFeature(TENANT, 'attendance')).resolves.toBe(true);
    await expect(s.getLimit(TENANT, 'students')).resolves.toBe(1500);
    await expect(s.getLimit(TENANT, 'staff')).resolves.toBeNull();
    await expect(s.getLimit(TENANT, 'storage_gb')).resolves.toBe(0);
    await expect(s.canMutate(TENANT)).resolves.toBe(true);
    await expect(s.status(TENANT)).resolves.toBe('ACTIVE');
  });

  it('an ended licence is read-only, and calls a trial by School’s name for it', async () => {
    writeFileSync(path, licence({ expiresAt: '2026-02-01T00:00:00.000Z' }));
    await expect(service().canMutate(TENANT)).resolves.toBe(false);
    await expect(service().status(TENANT)).resolves.toBe('EXPIRED');
    writeFileSync(
      path,
      licence({ status: 'TRIAL', expiresAt: null, trialEndsAt: '2099-01-01T00:00:00.000Z' }),
    );
    await expect(service().status(TENANT)).resolves.toBe('TRIALING');
  });

  it('a missing, forged or foreign licence grants nothing — never the un-subscribed default', async () => {
    const check = async () => {
      const s = service();
      await expect(s.canMutate(TENANT)).resolves.toBe(false);
      await expect(s.canUseFeature(TENANT, PlanFeature.ADVANCED_REPORTS)).resolves.toBe(false);
      await expect(s.getLimit(TENANT, 'students')).resolves.toBe(0);
    };
    rmSync(path, { force: true });
    await check();
    writeFileSync(path, licence({ installationId: 'another-server' }));
    await check();
    writeFileSync(path, licence({ tenantId: '0d1f4c9e-0000-4000-8000-000000000002' }));
    await check();
    const token = licence().split('\n').slice(1, -2).join('');
    const [format, , kid, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ limits: { students: 99999 } })).toString(
      'base64url',
    );
    writeFileSync(path, `${format}.${forged}.${kid}.${signature}`);
    await check();
  });

  it('refuses a private key where public keys belong, and a licence mode without its inputs', () => {
    expect(() =>
      validateEnv({
        ...env,
        LICENSE_PUBLIC_KEYS: JSON.stringify([{ kid: 'k', publicKey: pair.privateKey }]),
      }),
    ).toThrow(/private key/);
    expect(() =>
      validateEnv({ DATABASE_URL: env.DATABASE_URL, LICENSING_MODE: 'LICENSE_FILE' }),
    ).toThrow(/LICENSE_FILE_PATH/);
  });
});
