import { Injectable, OnModuleInit } from '@nestjs/common';
import { LimitKey } from '@school/domain';
import { DomainEvents, type DomainEvent } from '../events/domain-events';
import { SubscriptionService } from './subscription.service';
import { SubscriptionRepository } from './subscription.repository';

/** How a domain event maps onto the usage table: set an absolute value, or increment by a delta. */
export interface UsageMutation {
  metric: string;
  set?: number;
  increment?: number;
}

/** Metric key for cumulative API traffic (not a plan limit column, but tracked for the dashboard). */
export const API_CALLS_METRIC = 'api_calls';
export const AI_UNITS_METRIC = 'ai_units';

/**
 * Consumes domain events and maintains the {@link SubscriptionUsage} table. This is the ONLY writer
 * of usage counters — business modules publish facts and never touch subscription logic. The
 * {@link SubscriptionService} reads only the usage table, so producers and the resolver stay
 * decoupled (v2 event-driven usage).
 */
@Injectable()
export class UsageService implements OnModuleInit {
  constructor(
    private readonly events: DomainEvents,
    private readonly repo: SubscriptionRepository,
    private readonly subscriptions: SubscriptionService,
  ) {}

  onModuleInit(): void {
    this.events.subscribe((event) => this.handle(event));
  }

  /** Pure mapping from a domain event to a usage mutation (unit-testable, no I/O). */
  static toMutation(event: DomainEvent): UsageMutation | null {
    switch (event.type) {
      case 'StudentCreated':
      case 'StudentArchived':
        return { metric: LimitKey.STUDENTS, set: event.total };
      case 'CampusCreated':
      case 'CampusDeleted':
        return { metric: LimitKey.CAMPUSES, set: event.total };
      case 'StorageChanged':
        return { metric: LimitKey.STORAGE_GB, set: event.gigabytes };
      case 'ApiRequestRecorded':
        return { metric: API_CALLS_METRIC, increment: event.count ?? 1 };
      case 'AiUsageRecorded':
        return { metric: AI_UNITS_METRIC, increment: event.units ?? 1 };
      default:
        return null;
    }
  }

  /** Apply an event to the usage table, then invalidate the resolver cache for that tenant. */
  async handle(event: DomainEvent): Promise<void> {
    const mutation = UsageService.toMutation(event);
    if (!mutation) return;
    if (mutation.set !== undefined) {
      await this.repo.setUsage(event.tenantId, mutation.metric, Math.max(0, mutation.set));
    } else if (mutation.increment !== undefined) {
      await this.repo.incrementUsage(event.tenantId, mutation.metric, mutation.increment);
    }
    this.subscriptions.invalidate(event.tenantId);
  }
}
