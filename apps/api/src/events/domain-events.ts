import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

/**
 * Domain events published by business modules. Decouples producers (Students, Structure, Storage,
 * API/AI metering) from consumers (usage tracking, webhooks) — a module emits a fact and never
 * imports subscription/usage logic directly.
 *
 * Counter events carry the authoritative `total` (so the usage table can be set, not drifted);
 * metered events carry a delta.
 */
export type DomainEvent =
  | { type: 'StudentCreated'; tenantId: string; total: number }
  | { type: 'StudentArchived'; tenantId: string; total: number }
  | { type: 'CampusCreated'; tenantId: string; total: number }
  | { type: 'CampusDeleted'; tenantId: string; total: number }
  | { type: 'StorageChanged'; tenantId: string; gigabytes: number }
  | { type: 'ApiRequestRecorded'; tenantId: string; count?: number }
  | { type: 'AiUsageRecorded'; tenantId: string; units?: number }
  // --- HR staff-attendance integration events (Attendance evolution program) -------------------
  // Emitted by the HR staff-attendance write path (the canonical owner of StaffAttendance). Other
  // bounded contexts (Academics teacher-attendance sync, Transport driver duty, Notifications)
  // subscribe to these facts instead of importing HR. Payloads are primitive/serializable (no
  // Prisma enums) so the same event can later be persisted to a durable outbox unchanged.
  | {
      type: 'StaffAttendanceRecorded';
      tenantId: string;
      employeeId: string;
      /** ISO calendar day (YYYY-MM-DD) the attendance applies to. */
      date: string;
      /** Current StaffAttendanceStatus for the day (serialized). */
      status: string;
      /** StaffAttendanceSource that produced the mark (serialized). */
      source: string;
      /** Previous status when this write changed an existing day (a correction); null otherwise. */
      previousStatus: string | null;
    };

export type DomainEventType = DomainEvent['type'];

const CHANNEL = 'domain-event';

/**
 * A tiny in-process event bus (Node EventEmitter, dependency-free — consistent with this repo's
 * no-extra-deps philosophy). Handlers run asynchronously and are isolated: a throwing handler is
 * swallowed (logged by the handler itself) so one consumer never breaks the producer or peers.
 */
@Injectable()
export class DomainEvents {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Usage + webhook fan-out can add many listeners over the app lifetime; lift the default cap.
    this.emitter.setMaxListeners(100);
  }

  /** Publish an event to all subscribers (fire-and-forget). */
  emit(event: DomainEvent): void {
    this.emitter.emit(CHANNEL, event);
  }

  /** Subscribe to every domain event. Returns an unsubscribe function. */
  subscribe(handler: (event: DomainEvent) => void | Promise<void>): () => void {
    const wrapped = (event: DomainEvent) => {
      void Promise.resolve()
        .then(() => handler(event))
        .catch(() => {
          /* handlers own their error logging; never let one consumer break others */
        });
    };
    this.emitter.on(CHANNEL, wrapped);
    return () => this.emitter.off(CHANNEL, wrapped);
  }
}
