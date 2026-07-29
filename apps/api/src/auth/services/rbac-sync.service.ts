import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { withPlatform } from '../../prisma/tenant.helpers';
import { RbacService } from './rbac.service';

/**
 * Boot-time RBAC reconciliation. The role→permission baseline lives in @school/domain and is
 * materialized into the database at tenant provisioning — but tenants provisioned before a new
 * permission shipped never receive it, which silently hides newly gated features (e.g. a nav tab
 * whose permission did not exist yet). On every application boot we re-align the catalog and all
 * system roles with the code baseline (additive, idempotent), so new permissions reach existing
 * tenants without a manual migration.
 *
 * Set `RBAC_SYNC_ON_BOOT=off` to skip (e.g. in tests that manage their own provisioning).
 */
@Injectable()
export class RbacSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RbacSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.RBAC_SYNC_ON_BOOT === 'off') return;
    try {
      const { permissions, roles } = await withPlatform(this.prisma, (tx) =>
        this.rbac.syncCatalogAndSystemRoles(tx),
      );
      this.logger.log(
        `RBAC sync: ${permissions} permissions catalogued, ${roles} system roles aligned to defaults.`,
      );
    } catch (error) {
      // Never block startup on a sync failure — the app still runs on whatever grants exist.
      this.logger.error(
        `RBAC sync skipped (non-fatal): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
