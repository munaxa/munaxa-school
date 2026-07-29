/**
 * Integration test: tenant isolation end-to-end against a real PostgreSQL with the
 * RLS migration applied. Proves the withTenant/withPlatform helpers + RLS policies
 * physically prevent cross-tenant access.
 *
 * Requires DATABASE_URL pointing at a migrated database. Run via `pnpm test:e2e`
 * (CI applies migrations first). Connect with a NON-superuser role for RLS to apply.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { withTenant, withPlatform } from '../src/prisma/tenant.helpers';

const prisma = new PrismaClient();

const TENANT_A = '33333333-3333-3333-3333-333333333333';
const TENANT_B = '44444444-4444-4444-4444-444444444444';

describe('Tenant isolation (RLS) e2e', () => {
  beforeAll(async () => {
    await withPlatform(prisma, async (tx) => {
      const fixtures = [
        { id: TENANT_A, slug: 'iso-a' },
        { id: TENANT_B, slug: 'iso-b' },
      ];
      for (const { id, slug } of fixtures) {
        await tx.tenant.upsert({
          where: { id },
          update: {},
          create: { id, name: slug, slug, status: 'ACTIVE' },
        });
        await tx.school.create({
          data: { tenantId: id, nameEn: `${slug}-en`, nameAr: `${slug}-ar` },
        });
      }
    });
  });

  afterAll(async () => {
    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
    });
    await prisma.$disconnect();
  });

  it('a tenant session sees only its own schools', async () => {
    const schools = await withTenant(prisma, TENANT_A, (tx) => tx.school.findMany());
    expect(schools.length).toBeGreaterThan(0);
    expect(schools.every((s) => s.tenantId === TENANT_A)).toBe(true);
  });

  it('a tenant cannot create a row for another tenant', async () => {
    await expect(
      withTenant(prisma, TENANT_A, (tx) =>
        tx.school.create({ data: { tenantId: TENANT_B, nameEn: 'evil', nameAr: 'evil' } }),
      ),
    ).rejects.toThrow();
  });

  it('a platform session sees across tenants', async () => {
    const schools = await withPlatform(prisma, (tx) =>
      tx.school.findMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } }),
    );
    const tenantIds = new Set(schools.map((s) => s.tenantId));
    expect(tenantIds.has(TENANT_A)).toBe(true);
    expect(tenantIds.has(TENANT_B)).toBe(true);
  });

  // Regression guard for the finance/presence RLS gap closed in 20260616120000_finance_presence_rls.
  // Every tenant-scoped table MUST have RLS both ENABLED and FORCED (forced applies it to the
  // table owner too), otherwise a missing app-layer filter silently leaks across schools.
  it('enforces RLS on finance/e-invoicing + presence tables', async () => {
    const tables = [
      'EInvoiceSettings',
      'EInvoiceCredential',
      'EInvoiceCounter',
      'EInvoiceDocument',
      'EInvoiceLog',
      // AR domain (Finance Domain Spec v1.0) — every new tenant-scoped table is RLS-forced.
      'StudentFinancialAccount',
      'Payer',
      'Charge',
      'PaymentPlan',
      'Installment',
      'Payment',
      'PaymentReceiptCounter',
      'FeeAdjustment',
      'PaymentAllocation',
      'Credit',
      'RefundConsumption',
      'Refund',
      'StudentBillingProfile',
      'CollectionsCase',
      'PromiseToPay',
      'DunningEvent',
      // Presence / transport.
      'AttendanceSourceConfig',
      'StudentPresenceEvent',
      'BusAttendanceEvent',
    ];
    const rows = await withPlatform(
      prisma,
      (tx) =>
        tx.$queryRaw<
          Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>
        >`
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname IN (${Prisma.join(tables)})
      `,
    );
    expect(rows.length).toBe(tables.length);
    for (const r of rows) {
      expect({
        table: r.relname,
        enabled: r.relrowsecurity,
        forced: r.relforcerowsecurity,
      }).toEqual({ table: r.relname, enabled: true, forced: true });
    }
  });
});
