import { LimitKey } from '@school/domain';
import { UsageService, API_CALLS_METRIC, AI_UNITS_METRIC } from './usage.service';
import type { DomainEvents, DomainEvent } from '../events/domain-events';
import type { SubscriptionRepository } from './subscription.repository';
import type { SubscriptionService } from './subscription.service';

describe('UsageService.toMutation', () => {
  it('maps student events to an absolute students count', () => {
    expect(UsageService.toMutation({ type: 'StudentCreated', tenantId: 't', total: 42 })).toEqual({
      metric: LimitKey.STUDENTS,
      set: 42,
    });
    expect(UsageService.toMutation({ type: 'StudentArchived', tenantId: 't', total: 40 })).toEqual({
      metric: LimitKey.STUDENTS,
      set: 40,
    });
  });

  it('maps campus events to an absolute campuses count', () => {
    expect(UsageService.toMutation({ type: 'CampusCreated', tenantId: 't', total: 3 })).toEqual({
      metric: LimitKey.CAMPUSES,
      set: 3,
    });
  });

  it('maps storage to an absolute gigabytes value', () => {
    expect(
      UsageService.toMutation({ type: 'StorageChanged', tenantId: 't', gigabytes: 55 }),
    ).toEqual({ metric: LimitKey.STORAGE_GB, set: 55 });
  });

  it('maps API/AI events to increments with sensible defaults', () => {
    expect(UsageService.toMutation({ type: 'ApiRequestRecorded', tenantId: 't' })).toEqual({
      metric: API_CALLS_METRIC,
      increment: 1,
    });
    expect(UsageService.toMutation({ type: 'AiUsageRecorded', tenantId: 't', units: 5 })).toEqual({
      metric: AI_UNITS_METRIC,
      increment: 5,
    });
  });
});

describe('UsageService.handle', () => {
  function make() {
    const setUsage = jest.fn().mockResolvedValue(undefined);
    const incrementUsage = jest.fn().mockResolvedValue(undefined);
    const invalidate = jest.fn();
    const repo = { setUsage, incrementUsage } as unknown as SubscriptionRepository;
    const subscriptions = { invalidate } as unknown as SubscriptionService;
    const events = { subscribe: jest.fn() } as unknown as DomainEvents;
    return {
      service: new UsageService(events, repo, subscriptions),
      setUsage,
      incrementUsage,
      invalidate,
    };
  }

  it('sets the counter for absolute events and invalidates the resolver cache', async () => {
    const { service, setUsage, invalidate } = make();
    await service.handle({ type: 'StudentCreated', tenantId: 't1', total: 10 });
    expect(setUsage).toHaveBeenCalledWith('t1', LimitKey.STUDENTS, 10);
    expect(invalidate).toHaveBeenCalledWith('t1');
  });

  it('increments the counter for metered events', async () => {
    const { service, incrementUsage } = make();
    await service.handle({ type: 'ApiRequestRecorded', tenantId: 't1', count: 3 });
    expect(incrementUsage).toHaveBeenCalledWith('t1', API_CALLS_METRIC, 3);
  });

  it('ignores events it does not track', async () => {
    const { service, setUsage, incrementUsage } = make();
    await service.handle({ type: 'Unknown' } as unknown as DomainEvent);
    expect(setUsage).not.toHaveBeenCalled();
    expect(incrementUsage).not.toHaveBeenCalled();
  });
});
