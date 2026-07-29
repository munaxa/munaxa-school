import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlanVersionsService } from './plan-versions.service';
import type { PlanVersionsRepository } from './plan-versions.repository';
import type { SubscriptionService } from '../../subscription/subscription.service';

function make(overrides: Partial<PlanVersionsRepository> = {}) {
  const repo = {
    get: jest.fn(),
    migrationCandidates: jest.fn(),
    migrate: jest.fn(),
    ...overrides,
  } as unknown as PlanVersionsRepository;
  const invalidate = jest.fn();
  const subscriptions = { invalidate } as unknown as SubscriptionService;
  return { service: new PlanVersionsService(repo, subscriptions), repo, invalidate };
}

describe('PlanVersionsService.compare', () => {
  it('rejects comparing versions of different plans', async () => {
    const { service } = make({
      get: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'a',
          planId: 'p1',
          version: 1,
          limits: {},
          featureCodes: [],
          pricing: {},
        })
        .mockResolvedValueOnce({
          id: 'b',
          planId: 'p2',
          version: 1,
          limits: {},
          featureCodes: [],
          pricing: {},
        }),
    });
    await expect(service.compare('a', 'b')).rejects.toThrow(BadRequestException);
  });

  it('throws when a version is missing', async () => {
    const { service } = make({ get: jest.fn().mockResolvedValue(null) });
    await expect(service.compare('a', 'b')).rejects.toThrow(NotFoundException);
  });
});

describe('PlanVersionsService.migrate', () => {
  it('invalidates the resolver cache for every affected tenant', async () => {
    const { service, invalidate } = make({
      migrate: jest.fn().mockResolvedValue({ migrated: 2, tenantIds: ['t1', 't2'] }),
    });
    const result = await service.migrate('p1', 'v2');
    expect(result).toEqual({ migrated: 2 });
    expect(invalidate).toHaveBeenCalledWith('t1');
    expect(invalidate).toHaveBeenCalledWith('t2');
  });
});

describe('PlanVersionsService.migrationPreview', () => {
  it('summarizes the candidate schools without applying changes', async () => {
    const migrate = jest.fn();
    const { service } = make({
      migrate,
      migrationCandidates: jest
        .fn()
        .mockResolvedValue([
          { tenantId: 't1', planVersionId: null, tenant: { name: 'A', slug: 'a' } },
        ]),
    });
    const preview = await service.migrationPreview('p1', 'v2');
    expect(preview.count).toBe(1);
    expect(preview.schools[0]).toMatchObject({ tenantId: 't1', name: 'A' });
    expect(migrate).not.toHaveBeenCalled();
  });
});
