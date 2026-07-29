/**
 * Munaxa database seed (Phase 2).
 *
 * Seeds the GLOBAL permission catalog (the `Permission` table is not tenant-scoped).
 * Per-tenant system roles and their role→permission mappings are seeded during tenant
 * provisioning (Phase 4), not here.
 *
 * Run: `pnpm --filter @school/api db:seed` (DATABASE_URL must be set).
 */
import { PrismaClient } from '@prisma/client';
import {
  ALL_PERMISSIONS,
  FEATURE_CATALOG,
  PERMISSION_DESCRIPTIONS,
  PLAN_CATALOG_LIST,
} from '@school/domain';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  let count = 0;
  let planCount = 0;
  let featureCount = 0;
  // The Permission/SubscriptionPlan tables are RLS-protected: writes require the platform
  // context (app.is_platform='on'). Run the upserts inside one platform transaction.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;
    for (const key of ALL_PERMISSIONS) {
      const category = key.split(':')[0] ?? 'general';
      const description = PERMISSION_DESCRIPTIONS[key] ?? null;
      await tx.permission.upsert({
        where: { key },
        update: { category, description },
        create: { key, category, description },
      });
      count += 1;
    }

    // Subscription plan catalog (idempotent). Plans keyed by tier; capability rows keyed by
    // (plan, key). Limits with `null` mean unlimited. Core School OS modules are never seeded
    // here — they are always available on every plan.
    for (const def of PLAN_CATALOG_LIST) {
      const plan = await tx.subscriptionPlan.upsert({
        where: { tier: def.tier },
        update: {
          name: def.name,
          description: def.description,
          sortOrder: def.sortOrder,
          priceMonthly: def.priceMonthly,
          priceYearly: def.priceYearly,
          currency: def.currency,
          maxStudents: def.limits.maxStudents,
          maxCampuses: def.limits.maxCampuses,
          maxStaff: def.limits.maxStaff,
          storageGb: def.limits.storageGb,
          isActive: true,
        },
        create: {
          tier: def.tier,
          name: def.name,
          description: def.description,
          sortOrder: def.sortOrder,
          priceMonthly: def.priceMonthly,
          priceYearly: def.priceYearly,
          currency: def.currency,
          maxStudents: def.limits.maxStudents,
          maxCampuses: def.limits.maxCampuses,
          maxStaff: def.limits.maxStaff,
          storageGb: def.limits.storageGb,
        },
      });
      planCount += 1;
      for (const key of def.features) {
        await tx.subscriptionFeature.upsert({
          where: { planId_key: { planId: plan.id, key } },
          update: { enabled: true },
          create: { planId: plan.id, key, enabled: true },
        });
        featureCount += 1;
      }
    }

    // Feature Catalog (v2): the single catalog of capabilities that plans reference. Idempotent
    // by code. Core School OS modules are seeded as isCore = true (permanently enabled).
    for (const entry of FEATURE_CATALOG) {
      await tx.featureCatalog.upsert({
        where: { code: entry.code },
        update: {
          name: entry.name,
          description: entry.description,
          category: entry.category,
          isCore: entry.isCore,
          defaultEnabled: entry.defaultEnabled,
          enterpriseOnly: entry.enterpriseOnly,
          requiresApproval: entry.requiresApproval,
          sortOrder: entry.sortOrder,
        },
        create: {
          code: entry.code,
          name: entry.name,
          description: entry.description,
          category: entry.category,
          isCore: entry.isCore,
          defaultEnabled: entry.defaultEnabled,
          enterpriseOnly: entry.enterpriseOnly,
          requiresApproval: entry.requiresApproval,
          sortOrder: entry.sortOrder,
        },
      });
    }
  });
  // eslint-disable-next-line no-console
  console.log(
    `✔ Seeded ${count} permissions, ${planCount} plans, ${featureCount} plan features, ${FEATURE_CATALOG.length} catalog entries.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
