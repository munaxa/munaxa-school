import { Injectable } from '@nestjs/common';
import { Prisma, type FeatureFlag } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class FeatureFlagRepository extends TenantRepository {
  findAll(): Promise<FeatureFlag[]> {
    return this.run((tx) => tx.featureFlag.findMany({ orderBy: { key: 'asc' } }));
  }

  findByKey(key: string): Promise<FeatureFlag | null> {
    return this.run((tx) => tx.featureFlag.findFirst({ where: { key } }));
  }

  upsert(
    key: string,
    enabled: boolean,
    config: Prisma.InputJsonValue | undefined,
  ): Promise<FeatureFlag> {
    return this.run(async (tx, tenantId) => {
      const data = {
        enabled,
        ...(config !== undefined ? { config } : { config: Prisma.JsonNull }),
      };
      const existing = await tx.featureFlag.findFirst({ where: { key } });
      if (existing) {
        return tx.featureFlag.update({ where: { id: existing.id }, data });
      }
      return tx.featureFlag.create({ data: { tenantId, key, ...data } });
    });
  }
}
