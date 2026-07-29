import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from '../../subscription/subscription.service';
import { PlanVersionsRepository } from './plan-versions.repository';

/** Plan version administration. Publishing/retiring/migrating; no in-place edits of a version. */
@Injectable()
export class PlanVersionsService {
  constructor(
    private readonly repo: PlanVersionsRepository,
    private readonly subscriptions: SubscriptionService,
  ) {}

  list(planId: string) {
    return this.repo.list(planId);
  }

  createVersion(planId: string, notes?: string | null) {
    return this.repo.createSnapshot(planId, notes ?? null);
  }

  publish(id: string) {
    return this.repo.publish(id);
  }

  retire(id: string) {
    return this.repo.retire(id);
  }

  /** Side-by-side comparison of two versions of the same plan. */
  async compare(aId: string, bId: string) {
    const [a, b] = await Promise.all([this.repo.get(aId), this.repo.get(bId)]);
    if (!a || !b) throw new NotFoundException('Version not found');
    if (a.planId !== b.planId) throw new BadRequestException('Versions belong to different plans');
    return {
      a: {
        id: a.id,
        version: a.version,
        limits: a.limits,
        featureCodes: a.featureCodes,
        pricing: a.pricing,
      },
      b: {
        id: b.id,
        version: b.version,
        limits: b.limits,
        featureCodes: b.featureCodes,
        pricing: b.pricing,
      },
    };
  }

  /** Preview which subscriptions would move to a target version (no changes applied). */
  async migrationPreview(planId: string, toVersionId: string) {
    const candidates = await this.repo.migrationCandidates(planId, toVersionId);
    return {
      count: candidates.length,
      schools: candidates.map((c) => ({
        tenantId: c.tenantId,
        name: c.tenant.name,
        slug: c.tenant.slug,
        currentVersionId: c.planVersionId,
      })),
    };
  }

  /** Apply the migration and invalidate the resolver cache for every affected tenant. */
  async migrate(planId: string, toVersionId: string) {
    const result = await this.repo.migrate(planId, toVersionId);
    for (const tenantId of result.tenantIds) this.subscriptions.invalidate(tenantId);
    return { migrated: result.migrated };
  }
}
