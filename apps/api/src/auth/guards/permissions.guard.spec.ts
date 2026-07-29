import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from '@school/domain';
import type { AuthenticatedUser } from '../auth.types';

function ctx(user?: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const user: AuthenticatedUser = {
    userId: 'u',
    tenantId: 't',
    isPlatform: false,
    roles: [],
    permissions: [Permission.STUDENT_MANAGE],
  };

  it('allows when no permissions are required', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(ctx(user))).toBe(true);
  });

  it('allows when the principal holds the required permission', () => {
    const reflector = {
      getAllAndOverride: () => [Permission.STUDENT_MANAGE],
    } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(ctx(user))).toBe(true);
  });

  it('forbids when a required permission is missing', () => {
    const reflector = {
      getAllAndOverride: () => [Permission.FINANCE_MANAGE],
    } as unknown as Reflector;
    expect(() => new PermissionsGuard(reflector).canActivate(ctx(user))).toThrow(
      ForbiddenException,
    );
  });
});
