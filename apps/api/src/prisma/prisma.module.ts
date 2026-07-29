import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantConnectionManager } from './tenant-connection.service';

/**
 * Global Prisma module so the data layer is available to every feature module. Also provides the
 * {@link TenantConnectionManager}, which routes each tenant to its database (shared by default, a
 * dedicated/silo/on-prem DB when configured).
 */
@Global()
@Module({
  providers: [PrismaService, TenantConnectionManager],
  exports: [PrismaService, TenantConnectionManager],
})
export class PrismaModule {}
