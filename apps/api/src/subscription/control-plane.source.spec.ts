import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EntitlementSnapshot } from '@munaxa/licensing';
import { LimitKey, PlanFeature } from '@school/domain';
import type { Env } from '../config/env.validation';
import { validateEnv } from '../config/env.validation';
import { LicenceSource } from './licence.source';
import { SubscriptionService } from './subscription.service';
import type { SubscriptionRepository } from './subscription.repository';

const TENANT = '0d1f4c9e-0000-4000-8000-000000000001';
const HOUR = 3_600_000;
const T0 = new Date('2026-10-26T12:00:00.000Z');

const env = {
  DATABASE_URL: 'postgresql://app@localhost:5432/school',
  LICENSING_MODE: 'CONTROL_PLANE',
  CONTROL_PLANE_URL: 'https://control.munaxa.test/',
  CONTROL_PLANE_TOKEN: 'mxc_00000000-0000-4000-8000-000000000000_secret',
};

function snapshot(overrides: Partial<EntitlementSnapshot> = {}): EntitlementSnapshot {
  return {
    schemaVersion: 1,
    customerId: 'cus_1',
    tenantId: TENANT,
    product: 'school',
    deployment: 'SAAS',
    subscriptionId: 'sub_1',
    plan: { code: 'professional', version: 1 },
    status: 'ACTIVE',
    trialEndsAt: null,
    expiresAt: '2099-01-01T00:00:00.000Z',
    graceUntil: null,
    features: [PlanFeature.ADVANCED_REPORTS],
    limits: { students: 1500, campuses: 5, staff: null },
    resolvedAt: T0.toISOString(),
    ...overrides,
  };
}

type Reply = { status: number; body?: unknown } | Error;

/** A `fetch` that answers from a script and records what it was asked. */
function fakeFetch() {
  const replies: Reply[] = [];
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    const reply = replies.shift() ?? new Error('no scripted reply');
    if (reply instanceof Error) return Promise.reject(reply);
    const text = reply.body === undefined ? '' : JSON.stringify(reply.body);
    return Promise.resolve({
      ok: reply.status < 300,
      status: reply.status,
      text: () => Promise.resolve(text),
    } as Response);
  }) as unknown as typeof fetch;
  return { replies, calls, fetchImpl };
}

function configOf(values: Record<string, unknown>): ConfigService<Env, true> {
  const parsed = validateEnv(values);
  return { get: (key: keyof Env) => parsed[key] } as unknown as ConfigService<Env, true>;
}

/** Hosted School never consults its own subscription tables for a decision. */
const untouchable = new Proxy({} as SubscriptionRepository, {
  get: () => () => {
    throw new Error('the database plane was consulted in control-plane mode');
  },
});

function setup() {
  const http = fakeFetch();
  const source = new LicenceSource(configOf(env), http.fetchImpl);
  return { ...http, source, service: new SubscriptionService(untouchable, source) };
}

beforeEach(() => {
  // Only the clock is faked: the client's own timeouts run on real timers.
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'nextTick'] });
  jest.setSystemTime(T0);
});
afterEach(() => jest.useRealTimers());

describe('School against the central subscription service', () => {
  it('asks for this tenant only, with the credential, and never follows a redirect', async () => {
    const { replies, calls, service } = setup();
    replies.push({ status: 200, body: snapshot() });
    await expect(service.canUseFeature(TENANT, PlanFeature.ADVANCED_REPORTS)).resolves.toBe(true);
    await expect(service.canUseFeature(TENANT, PlanFeature.SSO)).resolves.toBe(false);
    await expect(service.getLimit(TENANT, LimitKey.STUDENTS)).resolves.toBe(1500);
    await expect(service.canMutate(TENANT)).resolves.toBe(true);
    expect(calls).toHaveLength(1); // reused within the refresh window
    expect(calls[0]?.url).toBe(
      `https://control.munaxa.test/api/v1/products/school/tenants/${TENANT}/entitlements`,
    );
    expect(calls[0]?.init.headers).toMatchObject({
      authorization: `Bearer ${env.CONTROL_PLANE_TOKEN}`,
    });
    expect(calls[0]?.init.redirect).toBe('error');
  });

  it('a suspended tenant keeps reading and changes nothing', async () => {
    const { replies, service } = setup();
    replies.push({ status: 200, body: snapshot({ status: 'SUSPENDED' }) });
    await expect(service.canMutate(TENANT)).resolves.toBe(false);
    await expect(service.status(TENANT)).resolves.toBe('SUSPENDED');
    await expect(service.canUseFeature(TENANT, 'attendance')).resolves.toBe(true);
  });

  it('no subscription grants nothing beyond the core modules, and outlives no cached snapshot', async () => {
    const { replies, service } = setup();
    replies.push({ status: 200, body: snapshot() });
    await expect(service.canMutate(TENANT)).resolves.toBe(true);
    jest.setSystemTime(T0.getTime() + 2 * 60_000);
    replies.push({ status: 404 });
    await expect(service.canMutate(TENANT)).resolves.toBe(false);
    await expect(service.getLimit(TENANT, LimitKey.STUDENTS)).resolves.toBe(0);
    await expect(service.canUseFeature(TENANT, 'attendance')).resolves.toBe(true);
    // The service then goes down: the withdrawn snapshot must not come back to bridge it.
    jest.setSystemTime(T0.getTime() + 4 * 60_000);
    replies.push(new Error('connect ECONNREFUSED'));
    await expect(service.canMutate(TENANT)).resolves.toBe(false);
  });

  it('an outage degrades the last answer by age: full, no growth, read-only, nothing', async () => {
    const { replies, service } = setup();
    replies.push({ status: 200, body: snapshot() });
    await expect(service.canMutate(TENANT)).resolves.toBe(true);

    const at = (hours: number) => {
      jest.setSystemTime(T0.getTime() + hours * HOUR);
      replies.push({ status: 503 });
    };
    at(0.5);
    await expect(service.assertCapacity(TENANT, LimitKey.STUDENTS, 10)).resolves.toBeUndefined();
    at(2);
    await expect(service.canMutate(TENANT)).resolves.toBe(true);
    await expect(service.assertCapacity(TENANT, LimitKey.STUDENTS, 10)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    at(48);
    await expect(service.canMutate(TENANT)).resolves.toBe(false);
    await expect(service.canUseFeature(TENANT, 'attendance')).resolves.toBe(true);
    at(8 * 24);
    await expect(service.canUseFeature(TENANT, PlanFeature.ADVANCED_REPORTS)).resolves.toBe(false);
  });

  it('a refused credential or an answer about someone else is an outage, not a cancellation', async () => {
    const { replies, service } = setup();
    replies.push({ status: 200, body: snapshot() });
    await expect(service.canMutate(TENANT)).resolves.toBe(true);
    for (const reply of [
      { status: 401 },
      { status: 200, body: snapshot({ tenantId: '0d1f4c9e-0000-4000-8000-000000000002' }) },
      { status: 200, body: { features: ['everything'] } },
    ]) {
      jest.setSystemTime(Date.now() + 2 * 60_000);
      replies.push(reply);
      // Still inside the freshness window of the last good answer: nothing withdrawn.
      await expect(service.canMutate(TENANT)).resolves.toBe(true);
    }
  });

  it('a clock wound back cannot make an ended term current again', async () => {
    const { replies, service } = setup();
    jest.setSystemTime(new Date('2027-01-10T00:00:00.000Z'));
    replies.push({ status: 200, body: snapshot({ expiresAt: '2027-01-01T00:00:00.000Z' }) });
    await expect(service.status(TENANT)).resolves.toBe('EXPIRED');
    jest.setSystemTime(new Date('2026-12-01T00:00:00.000Z'));
    replies.push({ status: 200, body: snapshot({ expiresAt: '2027-01-01T00:00:00.000Z' }) });
    await expect(service.status(TENANT)).resolves.toBe('EXPIRED');
  });

  it('reports usage levels best effort, never throwing', async () => {
    const { replies, calls, source } = setup();
    replies.push({ status: 202 });
    await source.reportUsage(TENANT, LimitKey.STUDENTS, 412.7);
    expect(calls[0]?.url).toBe('https://control.munaxa.test/api/v1/products/school/usage');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({
      reports: [{ tenantId: TENANT, metric: 'students', value: 412, measuredAt: T0.toISOString() }],
    });
    replies.push(new Error('network down'));
    await expect(source.reportUsage(TENANT, LimitKey.STUDENTS, 1)).resolves.toBeUndefined();
  });

  it('refuses to boot without its inputs, or with a plain-HTTP service in production', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: env.DATABASE_URL, LICENSING_MODE: 'CONTROL_PLANE' }),
    ).toThrow(/CONTROL_PLANE_URL/);
    expect(() =>
      validateEnv({
        ...env,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        CONTROL_PLANE_URL: 'http://control.munaxa.test',
      }),
    ).toThrow(/https/);
  });
});
