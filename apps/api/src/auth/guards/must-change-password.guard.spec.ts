import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { MustChangePasswordGuard } from './must-change-password.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_DURING_PASSWORD_CHANGE_KEY } from '../decorators/allow-during-password-change.decorator';
import type { AuthenticatedUser } from '../auth.types';

/** Build an ExecutionContext whose request carries the given user. */
function contextFor(user?: Partial<AuthenticatedUser>): ExecutionContext {
  const request = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

/** Reflector stub returning metadata keyed by the decorator constant. */
function reflectorWith(meta: Record<string, boolean>): Reflector {
  return {
    getAllAndOverride: (key: string) => meta[key],
  } as unknown as Reflector;
}

describe('MustChangePasswordGuard', () => {
  it('allows public routes regardless of the flag', () => {
    const guard = new MustChangePasswordGuard(reflectorWith({ [IS_PUBLIC_KEY]: true }));
    expect(guard.canActivate(contextFor({ mustChangePassword: true }))).toBe(true);
  });

  it('allows requests without an authenticated principal', () => {
    const guard = new MustChangePasswordGuard(reflectorWith({}));
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it('allows normal users (flag not set)', () => {
    const guard = new MustChangePasswordGuard(reflectorWith({}));
    expect(guard.canActivate(contextFor({ mustChangePassword: false }))).toBe(true);
  });

  it('blocks a temp-password user on a protected route', () => {
    const guard = new MustChangePasswordGuard(reflectorWith({}));
    expect(() => guard.canActivate(contextFor({ mustChangePassword: true }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows a temp-password user on a whitelisted route (change-password / me)', () => {
    const guard = new MustChangePasswordGuard(
      reflectorWith({ [ALLOW_DURING_PASSWORD_CHANGE_KEY]: true }),
    );
    expect(guard.canActivate(contextFor({ mustChangePassword: true }))).toBe(true);
  });
});
