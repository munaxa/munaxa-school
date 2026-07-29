import type { ChannelJob } from './channel-job';

/**
 * Broker-agnostic queue contract. Producers (the engine) depend only on this port, so the
 * in-process implementation can be swapped for a BullMQ + Redis adapter (separate worker fleet,
 * horizontal scaling) without touching the engine. Implementations MUST provide background
 * processing, exponential backoff, a retry limit, failure tracking, and dead-lettering.
 */
export abstract class NotificationQueuePort {
  /** Enqueue a single channel job for asynchronous delivery. */
  abstract enqueue(job: ChannelJob): Promise<void>;

  /** Bulk enqueue (fan-out). */
  abstract enqueueMany(jobs: ChannelJob[]): Promise<void>;
}
