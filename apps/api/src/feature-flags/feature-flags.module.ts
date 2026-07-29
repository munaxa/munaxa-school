import { Global, Module } from '@nestjs/common';
import { FeatureGate } from './feature-gate.service';
import { FeatureFlagGuard } from './feature-flag.guard';

/**
 * Feature-flag framework (Phase 14). Global so any advanced module can apply
 * `@UseGuards(FeatureFlagGuard)` + `@RequireFeature(key)` to gate itself behind a per-tenant
 * flag. Flags themselves are toggled via the existing `/feature-flags` admin endpoints (Phase 10),
 * and are OFF by default.
 */
@Global()
@Module({
  providers: [FeatureGate, FeatureFlagGuard],
  exports: [FeatureGate, FeatureFlagGuard],
})
export class FeatureFlagsModule {}
