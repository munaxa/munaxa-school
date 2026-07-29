import { SetMetadata } from '@nestjs/common';
import type { PlanFeature } from '@school/domain';

export const PLAN_FEATURE_KEY = 'requiredPlanFeature';

/**
 * Declares that a route requires a paid subscription capability (e.g. API, AI, SSO,
 * white-label). Enforced by {@link PlanFeatureGuard}, which resolves availability through the
 * central {@link SubscriptionService} (plan + per-tenant overrides). Core School OS modules are
 * never gated this way.
 */
export const RequirePlanFeature = (feature: PlanFeature) => SetMetadata(PLAN_FEATURE_KEY, feature);
