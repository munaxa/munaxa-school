import { Global, Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionRepository } from './subscription.repository';
import { PlanFeatureGuard } from './plan-feature.guard';
import { PricingService } from './pricing.service';
import { ReadOnlyStateGuard } from './read-only-state.guard';
import { UsageService } from './usage.service';

/**
 * Subscription plane. Exported globally so any module can enforce limits/capabilities through
 * the central {@link SubscriptionService} (and use {@link PlanFeatureGuard} / `@RequirePlanFeature`)
 * without re-importing. v2 adds {@link PricingService} (commercial pricing, decoupled from
 * entitlements) and {@link ReadOnlyStateGuard} (blocks writes when a subscription is READ_ONLY).
 */
@Global()
@Module({
  controllers: [SubscriptionController],
  providers: [
    SubscriptionService,
    SubscriptionRepository,
    PlanFeatureGuard,
    PricingService,
    ReadOnlyStateGuard,
    UsageService,
  ],
  exports: [SubscriptionService, PlanFeatureGuard, PricingService, ReadOnlyStateGuard],
})
export class SubscriptionModule {}
