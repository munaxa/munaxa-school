import { Injectable, Logger } from '@nestjs/common';
import { TenantContextStore } from '../../prisma/tenant-context';
import { ChannelDispatcher } from '../dispatch/dispatcher.service';
import { DeliveryRepository } from '../delivery/delivery.repository';
import { DeviceRepository } from '../devices/device.repository';
import { NotificationQueuePort } from './notification-queue.port';
import type { ChannelJob } from './channel-job';

const MAX_ATTEMPTS = 5;
const MAX_CONCURRENCY = 20;

/**
 * Phase-1 in-process queue: background processing with bounded concurrency, exponential backoff,
 * a retry limit, per-attempt failure tracking (NotificationDelivery), invalid-token cleanup, and
 * dead-lettering (status → FAILED after MAX_ATTEMPTS). Implements {@link NotificationQueuePort} so
 * a BullMQ + Redis adapter can replace it without changing the engine (see doc 13b §7).
 */
@Injectable()
export class InProcessQueue extends NotificationQueuePort {
  private readonly logger = new Logger(InProcessQueue.name);
  private active = 0;
  private readonly pending: ChannelJob[] = [];

  constructor(
    private readonly dispatcher: ChannelDispatcher,
    private readonly deliveries: DeliveryRepository,
    private readonly devices: DeviceRepository,
  ) {
    super();
  }

  enqueue(job: ChannelJob): Promise<void> {
    this.pending.push(job);
    this.pump();
    return Promise.resolve();
  }

  enqueueMany(jobs: ChannelJob[]): Promise<void> {
    this.pending.push(...jobs);
    this.pump();
    return Promise.resolve();
  }

  /** Drain the queue respecting MAX_CONCURRENCY. */
  private pump(): void {
    while (this.active < MAX_CONCURRENCY && this.pending.length > 0) {
      const job = this.pending.shift()!;
      this.active += 1;
      void this.process(job).finally(() => {
        this.active -= 1;
        this.pump();
      });
    }
  }

  private async process(job: ChannelJob): Promise<void> {
    await TenantContextStore.run({ tenantId: job.tenantId }, async () => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          const result = await this.dispatcher.deliver(job);

          if (result.invalidTokens?.length) {
            await this.devices.deactivateTokens(result.invalidTokens).catch(() => undefined);
          }

          if (result.ok) {
            await this.deliveries.record(job.deliveryId, 'SENT', result.response);
            return;
          }
          await this.deliveries.record(job.deliveryId, 'FAILED', result.response);
        } catch (err) {
          this.logger.warn(`Job ${job.deliveryId} attempt ${attempt} failed: ${String(err)}`);
          await this.deliveries
            .record(job.deliveryId, 'FAILED', { error: String(err) })
            .catch(() => undefined);
        }

        if (attempt < MAX_ATTEMPTS) {
          await delay(backoffMs(attempt));
        }
      }
      // Dead-lettered: the delivery row is left at FAILED after the final attempt.
      this.logger.warn(`Job ${job.deliveryId} dead-lettered after ${MAX_ATTEMPTS} attempts`);
    });
  }
}

/** Exponential backoff: 2^attempt seconds, capped at 30s. */
function backoffMs(attempt: number): number {
  return Math.min(2 ** attempt, 30) * 1000;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
