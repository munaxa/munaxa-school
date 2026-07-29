import type { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@prisma/client';
import { TenantConnectionManager } from './tenant-connection.service';
import type { PrismaService } from './prisma.service';

const SHARED = { id: 'shared' } as unknown as PrismaService;
const SILOED = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SHARED_TENANT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

/** Test manager that never opens real connections — `makeClient` returns tagged fakes. */
class TestManager extends TenantConnectionManager {
  makeClientCalls = 0;
  protected override makeClient(url: string): PrismaClient {
    this.makeClientCalls += 1;
    return { __url: url } as unknown as PrismaClient;
  }
}

function manager(overrides?: Record<string, string>): TestManager {
  const config = {
    get: (key: string) =>
      key === 'TENANT_DATABASE_OVERRIDES' && overrides ? JSON.stringify(overrides) : undefined,
  } as unknown as ConfigService;
  return new TestManager(SHARED, config);
}

describe('TenantConnectionManager', () => {
  it('routes every tenant to the shared client when no overrides are configured', () => {
    const m = manager();
    expect(m.clientFor(SHARED_TENANT)).toBe(SHARED);
    expect(m.hasDedicatedDatabase(SHARED_TENANT)).toBe(false);
    expect(m.siloedTenantIds()).toEqual([]);
  });

  it('routes a siloed tenant to its own dedicated client, and others to the shared one', () => {
    const m = manager({ [SILOED]: 'postgresql://host/school_a' });
    expect(m.hasDedicatedDatabase(SILOED)).toBe(true);
    expect(m.clientFor(SHARED_TENANT)).toBe(SHARED);

    const dedicated = m.clientFor(SILOED) as unknown as { __url: string };
    expect(dedicated).not.toBe(SHARED);
    expect(dedicated.__url).toBe('postgresql://host/school_a');
    expect(m.siloedTenantIds()).toEqual([SILOED]);
  });

  it('caches the dedicated client (one connection per database)', () => {
    const m = manager({ [SILOED]: 'postgresql://host/school_a' });
    const a = m.clientFor(SILOED);
    const b = m.clientFor(SILOED);
    expect(a).toBe(b);
    expect(m.makeClientCalls).toBe(1);
  });

  it('falls back to all-shared when the registry JSON is malformed', () => {
    const config = {
      get: () => 'not-json{',
    } as unknown as ConfigService;
    const m = new TestManager(SHARED, config);
    expect(m.clientFor(SILOED)).toBe(SHARED);
    expect(m.siloedTenantIds()).toEqual([]);
  });
});
