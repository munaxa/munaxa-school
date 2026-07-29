import { SetMetadata } from '@nestjs/common';

export const FEATURE_KEY = 'requiredFeature';

/** Feature-flag keys for the optional advanced modules (Phase 14). OFF by default per tenant. */
export const FeatureFlagKey = {
  BUS_TRACKING: 'bus_tracking',
  LIBRARY_MANAGEMENT: 'library_management',
  INVENTORY_MANAGEMENT: 'inventory_management',
  SCHOOL_CLINIC: 'school_clinic',
  E_INVOICING: 'e_invoicing',
} as const;

export type FeatureFlagKey = (typeof FeatureFlagKey)[keyof typeof FeatureFlagKey];

/**
 * Gates a controller/route behind a per-tenant feature flag. The {@link FeatureFlagGuard}
 * rejects the request (403) unless the tenant has explicitly enabled the flag — so every
 * advanced module is disabled by default.
 */
export const RequireFeature = (key: string) => SetMetadata(FEATURE_KEY, key);
