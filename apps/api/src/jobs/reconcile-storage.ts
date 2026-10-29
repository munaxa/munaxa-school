/**
 * Storage reconciliation — `pnpm --filter @school/api storage:reconcile` (after `nest build`).
 *
 * For every school, lists its prefix in the bucket and brings the storage ledger in line with it
 * (StorageService.reconcileTenant): objects uploaded but never confirmed, and objects that predate
 * the ledger, are counted; objects the bucket no longer holds are not. The `storage_gb` limit is
 * enforced on every upload regardless; this keeps it honest about what the bucket really holds.
 *
 * Run it on a schedule (daily is enough) and once after the `stored_objects` migration is first
 * deployed. Read-only against the bucket; writes only the ledger. Exits non-zero if any school
 * could not be reconciled, so the scheduler can alert.
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { StorageService } from '../common/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { withPlatform } from '../prisma/tenant.helpers';
import { PLATFORM_TENANT_ID } from '../platform/platform.constants';

async function main(): Promise<number> {
  const logger = new Logger('StorageReconciliation');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const storage = app.get(StorageService);
    if (!storage.configured) {
      logger.warn('No bucket is configured (AWS_S3_BUCKET); nothing to reconcile.');
      return 0;
    }
    const tenants = await withPlatform(app.get(PrismaService), (tx) =>
      tx.tenant.findMany({ where: { id: { not: PLATFORM_TENANT_ID } }, select: { id: true } }),
    );
    let failed = 0;
    for (const { id } of tenants) {
      try {
        const result = await storage.reconcileTenant(id);
        if (result && (result.adopted > 0 || result.vanished > 0)) {
          logger.log(`${id}: adopted ${result.adopted}, released ${result.vanished}`);
        }
      } catch (error) {
        failed += 1;
        logger.error(`${id}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    logger.log(`Reconciled ${tenants.length - failed} of ${tenants.length} school(s).`);
    return failed === 0 ? 0 : 1;
  } finally {
    await app.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
