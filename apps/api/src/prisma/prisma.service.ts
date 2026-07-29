import { Injectable, type OnModuleInit, type OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client wrapper managed by Nest's lifecycle.
 *
 * Tenant-isolation middleware (auto-injecting `tenantId` filters) and RLS session
 * configuration are layered on top of this service in Phase 3, once the auth/tenant
 * context exists. At the foundation stage it only manages the connection lifecycle.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
