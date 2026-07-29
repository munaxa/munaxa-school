import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@school/domain';

export const PERMISSIONS_KEY = 'requiredPermissions';
export const ANY_PERMISSIONS_KEY = 'requiredAnyPermissions';

/**
 * Declares the permissions required to access a route. The {@link PermissionsGuard}
 * enforces that the principal holds ALL listed permissions.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Declares an alternative set of permissions where holding ANY ONE grants access.
 * Useful for routes shared by different principals (e.g. parents with `leave:request`
 * and staff with `leave:approve`), each row-scoped further in the service layer.
 */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
