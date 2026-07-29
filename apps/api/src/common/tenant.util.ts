import { ForbiddenException } from '@nestjs/common';
import { TenantContextStore } from '../prisma/tenant-context';

/**
 * Returns the active tenant id from the request-scoped context, or throws if absent.
 * School-plane endpoints require a tenant; platform principals must use platform-scoped APIs.
 */
export function requireTenantId(): string {
  const tenantId = TenantContextStore.getTenantId();
  if (!tenantId) {
    throw new ForbiddenException('A tenant context is required for this operation');
  }
  return tenantId;
}
