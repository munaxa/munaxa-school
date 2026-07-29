import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ReadOnlyStateGuard } from './read-only-state.guard';
import type { SubscriptionService } from './subscription.service';

function ctx(method: string, user: unknown): ExecutionContext {
  const request = { method, user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardWith(canMutateResult: boolean, reflectorAllows = false) {
  const reflector = { getAllAndOverride: () => reflectorAllows } as unknown as Reflector;
  const canMutate = jest.fn<Promise<boolean>, [string]>().mockResolvedValue(canMutateResult);
  const subscriptions = { canMutate } as unknown as SubscriptionService;
  return { guard: new ReadOnlyStateGuard(reflector, subscriptions), canMutate };
}

const school = { tenantId: 't1', isPlatform: false };

describe('ReadOnlyStateGuard', () => {
  it('allows safe (read) methods regardless of state', async () => {
    const { guard, canMutate } = guardWith(false);
    await expect(guard.canActivate(ctx('GET', school))).resolves.toBe(true);
    expect(canMutate).not.toHaveBeenCalled();
  });

  it('allows the platform plane to mutate', async () => {
    const { guard } = guardWith(false);
    await expect(guard.canActivate(ctx('POST', { tenantId: 'p', isPlatform: true }))).resolves.toBe(
      true,
    );
  });

  it('blocks a write when the subscription cannot mutate (READ_ONLY)', async () => {
    const { guard } = guardWith(false);
    await expect(guard.canActivate(ctx('POST', school))).rejects.toThrow(ForbiddenException);
  });

  it('allows a write when the subscription can mutate (ACTIVE)', async () => {
    const { guard } = guardWith(true);
    await expect(guard.canActivate(ctx('DELETE', school))).resolves.toBe(true);
  });

  it('allows routes marked @AllowInReadOnly even when read-only', async () => {
    const { guard, canMutate } = guardWith(false, true);
    await expect(guard.canActivate(ctx('POST', school))).resolves.toBe(true);
    expect(canMutate).not.toHaveBeenCalled();
  });

  it('allows unauthenticated (public) requests through', async () => {
    const { guard } = guardWith(false);
    await expect(guard.canActivate(ctx('POST', undefined))).resolves.toBe(true);
  });
});
