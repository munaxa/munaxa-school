import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Resolves which database a tenant's data lives in (the hybrid "pool + opt-in silo" model).
 *
 * By default every tenant shares the one application database and is isolated by PostgreSQL RLS
 * (the dense, simple, cheap path). A tenant can be *promoted* to its own database — same server,
 * a separate server/region, or the school's own/on-prem PostgreSQL — without any change to
 * application logic: only its connection URL changes here.
 *
 * The registry of overrides is supplied as config (`TENANT_DATABASE_OVERRIDES`, a JSON object
 * mapping `tenantId → connection URL`) so the URLs + credentials live in the secrets manager,
 * never in the shared database. An empty/unset registry means "all tenants share the default DB",
 * which is exactly today's behaviour — so this is a no-op until a school is explicitly siloed.
 *
 * Dedicated databases carry the **same schema and the same RLS policies**; isolation is therefore
 * never weaker than the shared path. Platform-plane (cross-tenant) work always uses the shared
 * control-plane database via `PrismaService` directly.
 */
@Injectable()
export class TenantConnectionManager implements OnModuleDestroy {
  private readonly logger = new Logger(TenantConnectionManager.name);
  /** tenantId → dedicated connection URL. */
  private readonly overrides: Map<string, string>;
  /** url → cached client (one per distinct database). */
  private readonly clients = new Map<string, PrismaClient>();

  constructor(
    private readonly defaultClient: PrismaService,
    config: ConfigService,
  ) {
    this.overrides = parseOverrides(config.get<string>('TENANT_DATABASE_OVERRIDES'), this.logger);
    if (this.overrides.size > 0) {
      this.logger.log(`Tenant DB routing: ${this.overrides.size} siloed tenant(s) configured`);
    }
  }

  /** Whether this tenant has its own dedicated database (vs the shared default). */
  hasDedicatedDatabase(tenantId: string): boolean {
    return this.overrides.has(tenantId);
  }

  /** All tenant ids that are siloed onto a dedicated database. */
  siloedTenantIds(): string[] {
    return [...this.overrides.keys()];
  }

  /**
   * The Prisma client for a tenant's database: a dedicated client when the tenant is siloed,
   * otherwise the shared default. Dedicated clients are created lazily and cached per URL.
   */
  clientFor(tenantId: string): PrismaClient {
    const url = this.overrides.get(tenantId);
    if (!url) return this.defaultClient;
    return this.getOrCreate(url);
  }

  /** Overridable for tests; production creates a real client bound to `url`. */
  protected makeClient(url: string): PrismaClient {
    return new PrismaClient({ datasources: { db: { url } } });
  }

  private getOrCreate(url: string): PrismaClient {
    let client = this.clients.get(url);
    if (!client) {
      client = this.makeClient(url);
      this.clients.set(url, client);
    }
    return client;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.clients.values()].map((c) =>
        c.$disconnect().catch((e: unknown) => this.logger.warn(`Disconnect failed: ${String(e)}`)),
      ),
    );
  }
}

/** Parse the JSON `{ tenantId: url }` registry from config; tolerant of unset/malformed input. */
function parseOverrides(raw: string | undefined, logger: Logger): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw || !raw.trim()) return map;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [tenantId, url] of Object.entries(parsed)) {
      if (typeof url === 'string' && url.length > 0) map.set(tenantId, url);
    }
  } catch {
    logger.error('TENANT_DATABASE_OVERRIDES is not valid JSON; ignoring (all tenants shared).');
  }
  return map;
}
