import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { TenantIsolationGuard } from './tenant-isolation.guard';
import type { AuthenticatedUser } from '../auth.types';

function ctx(
  user: AuthenticatedUser | undefined,
  parts: { params?: object; query?: object; body?: object },
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, params: parts.params, query: parts.query, body: parts.body }),
    }),
  } as unknown as ExecutionContext;
}

const schoolUser: AuthenticatedUser = {
  userId: 'u',
  tenantId: 'tenant-a',
  isPlatform: false,
  roles: [],
  permissions: [],
};

describe('TenantIsolationGuard', () => {
  const guard = new TenantIsolationGuard();

  it('allows when supplied tenantId matches the principal', () => {
    expect(guard.canActivate(ctx(schoolUser, { body: { tenantId: 'tenant-a' } }))).toBe(true);
  });

  it('blocks a mismatched tenantId', () => {
    expect(() => guard.canActivate(ctx(schoolUser, { query: { tenantId: 'tenant-b' } }))).toThrow(
      ForbiddenException,
    );
  });

  it('exempts platform principals', () => {
    const platform = { ...schoolUser, isPlatform: true };
    expect(guard.canActivate(ctx(platform, { body: { tenantId: 'tenant-z' } }))).toBe(true);
  });
});
