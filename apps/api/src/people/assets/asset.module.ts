import { Module } from '@nestjs/common';
import { AssetController, EmployeeAssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { AssetRepository } from './asset.repository';

/**
 * HR Phase 7 — asset management: a register of discrete, custody-tracked assets (laptops, keys,
 * uniforms, vehicles…) and their assign/return lifecycle per employee. Distinct from the fungible
 * InventoryItem stock module. Tenant-scoped and audited.
 */
@Module({
  controllers: [AssetController, EmployeeAssetController],
  providers: [AssetService, AssetRepository],
  exports: [AssetService], // reused by the self-service portal (Phase 9)
})
export class AssetModule {}
