import { SetMetadata } from '@nestjs/common';

export const ALLOW_IN_READ_ONLY_KEY = 'allowInReadOnly';

/**
 * Marks a route as still usable when the tenant's subscription is READ_ONLY. Applied to the few
 * writes a locked-out school must keep (e.g. requesting an upgrade, changing password, logging out).
 * All other mutating routes are blocked by {@link ReadOnlyStateGuard}.
 */
export const AllowInReadOnly = () => SetMetadata(ALLOW_IN_READ_ONLY_KEY, true);
