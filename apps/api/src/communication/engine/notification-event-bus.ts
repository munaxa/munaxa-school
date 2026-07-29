import { Injectable } from '@nestjs/common';
import { NotificationEngine, type DispatchSummary } from './notification-engine.service';
import type { NotificationEvent } from './notification-events';

/**
 * The single entry point domain modules use to raise notification events. Modules depend ONLY on
 * this bus — never on FCM/Resend/the engine internals. Today it forwards in-process to the engine
 * (which persists + enqueues); the same interface backs a Redis Streams transport when the worker
 * fleet is split out (doc 13b §2, §7).
 *
 * Persisting the in-app notification + enqueuing channel jobs is synchronous within the caller's
 * tenant/RLS context; actual channel delivery is always asynchronous (queue-driven).
 */
@Injectable()
export class NotificationEventBus {
  constructor(private readonly engine: NotificationEngine) {}

  emit(event: NotificationEvent): Promise<DispatchSummary> {
    return this.engine.handle(event);
  }
}
