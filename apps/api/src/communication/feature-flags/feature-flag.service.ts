import { Injectable } from '@nestjs/common';
import type { FeatureFlag, Prisma } from '@prisma/client';
import { FeatureGate } from '../../feature-flags/feature-gate.service';
import { TenantContextStore } from '../../prisma/tenant-context';
import { FeatureFlagRepository } from './feature-flag.repository';
import type { SetFeatureFlagDto } from './feature-flag.dto';

@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly repo: FeatureFlagRepository,
    private readonly gate: FeatureGate,
  ) {}

  list(): Promise<FeatureFlag[]> {
    return this.repo.findAll();
  }

  async set(key: string, dto: SetFeatureFlagDto): Promise<FeatureFlag> {
    const flag = await this.repo.upsert(
      key,
      dto.enabled,
      dto.config as Prisma.InputJsonValue | undefined,
    );
    // Drop the gate cache so a toggle takes effect immediately (not after the TTL).
    const tenantId = TenantContextStore.getTenantId();
    if (tenantId) this.gate.invalidate(tenantId, key);
    return flag;
  }

  async isEnabled(key: string): Promise<boolean> {
    const flag = await this.repo.findByKey(key);
    return flag?.enabled ?? false;
  }
}
