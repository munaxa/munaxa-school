import { Module } from '@nestjs/common';
import { TenantProvisioningController } from './tenant-provisioning/tenant-provisioning.controller';
import { TenantProvisioningService } from './tenant-provisioning/tenant-provisioning.service';
import { TenantProvisioningRepository } from './tenant-provisioning/tenant-provisioning.repository';

/**
 * Platform plane (super-admin) operations. Currently: the tenant-database promotion wizard
 * (pool → dedicated/silo). Everything here is gated by platform permissions.
 */
@Module({
  controllers: [TenantProvisioningController],
  providers: [TenantProvisioningService, TenantProvisioningRepository],
})
export class PlatformModule {}
