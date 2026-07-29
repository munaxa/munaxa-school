import { TenantContextStore } from './tenant-context';

describe('TenantContextStore', () => {
  it('returns undefined when no context is bound', () => {
    expect(TenantContextStore.get()).toBeUndefined();
    expect(TenantContextStore.getTenantId()).toBeUndefined();
    expect(TenantContextStore.isPlatform()).toBe(false);
  });

  it('exposes the tenant context within run()', () => {
    TenantContextStore.run({ tenantId: 'tenant-a', actorUserId: 'user-1' }, () => {
      expect(TenantContextStore.getTenantId()).toBe('tenant-a');
      expect(TenantContextStore.isPlatform()).toBe(false);
      expect(TenantContextStore.get()?.actorUserId).toBe('user-1');
    });
  });

  it('isolates nested platform context', () => {
    TenantContextStore.run({ tenantId: 'tenant-a' }, () => {
      TenantContextStore.run({ isPlatform: true }, () => {
        expect(TenantContextStore.isPlatform()).toBe(true);
        expect(TenantContextStore.getTenantId()).toBeUndefined();
      });
      // Outer context restored after the nested scope.
      expect(TenantContextStore.getTenantId()).toBe('tenant-a');
    });
  });
});
