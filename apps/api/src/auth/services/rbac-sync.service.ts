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
 * Runs in the BACKGROUND. Nest awaits every `onApplicationBootstrap` hook before
 * `app.listen()` binds the HTTP port, so awaiting a cross-tenant reconciliation here leaves the
 * process portless for as long as the database takes to answer — which a platform that probes
 * the port from outside (Render) reports as "no open ports detected" and fails the deploy.
 * Readiness must not depend on this: the app serves fine on whatever grants already exist.
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

  onApplicationBootstrap(): void {
    if (process.env.RBAC_SYNC_ON_BOOT === 'off') return;
    // Deliberately not awaited — see the class comment. Errors are handled inside run().
    void this.run();
  }

  private async run(): Promise<void> {
    this.logger.log('RBAC sync starting (background).');
    try {
      const { permissions, roles } = await withPlatform(
        this.prisma,
        (tx) => this.rbac.syncCatalogAndSystemRoles(tx),
        // Well above the 5s default: this is a bulk reconciliation over a pooled remote
        // database. Bounded so a stuck transaction cannot linger for the process's lifetime.
        { maxWait: 15_000, timeout: 120_000 },
      );
      this.logger.log(
        `RBAC sync: ${permissions} permissions catalogued, ${roles} system roles aligned to defaults.`,
      );
    } catch (error) {
      // Never fail startup on a sync failure — the app still runs on whatever grants exist.
      this.logger.error(
        `RBAC sync skipped (non-fatal): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
