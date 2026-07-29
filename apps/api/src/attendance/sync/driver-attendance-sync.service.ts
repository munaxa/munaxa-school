import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { StaffAttendanceStatus } from '@prisma/client';
import { DomainEvents, type DomainEvent } from '../../events/domain-events';
import { TenantContextStore } from '../../prisma/tenant-context';
import { DriverLinkRepository } from './driver-link.repository';
import { resolveDriverDuty, type DriverDutySignal } from './driver-duty.logic';

/** What a consumer (transport ops UI, notification) receives when a driver's duty changes. */
export interface DriverDutyChange extends DriverDutySignal {
  tenantId: string;
  employeeId: string;
  driverProfileId: string;
  date: string;
  /** Buses this driver is assigned to — the concrete routes at risk. */
  busIds: string[];
}

/**
 * HR → Transport driver-duty synchronisation (PR-7).
 *
 * Subscribes to `StaffAttendanceRecorded`; when the employee has a driver profile, it resolves the
 * transport-facing duty signal and exposes it to transport consumers. Transport owns its own
 * aggregates — this service reads the existing driver/bus links and raises a signal, it never
 * writes into transport tables or imports transport services.
 *
 * Consumers subscribe via {@link onDutyChange}; nothing is coupled at construction time.
 */
@Injectable()
export class DriverAttendanceSyncService implements OnModuleInit {
  private readonly logger = new Logger(DriverAttendanceSyncService.name);
  private readonly listeners = new Set<(change: DriverDutyChange) => void | Promise<void>>();

  constructor(
    private readonly events: DomainEvents,
    private readonly links: DriverLinkRepository,
  ) {}

  onModuleInit(): void {
    this.events.subscribe((event) => this.handle(event));
  }

  /** Subscribe to driver-duty changes. Returns an unsubscribe function. */
  onDutyChange(listener: (change: DriverDutyChange) => void | Promise<void>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== 'StaffAttendanceRecorded') return;

    try {
      await TenantContextStore.run({ tenantId: event.tenantId }, async () => {
        const driver = await this.links.driverForEmployee(event.employeeId);
        // Most employees do not drive; nothing to signal.
        if (!driver) return;

        const signal = resolveDriverDuty(event.status as StaffAttendanceStatus);
        // Only surface changes that actually affect service.
        if (signal.affectedLegs.length === 0 && !signal.needsReplacement) return;

        const change: DriverDutyChange = {
          ...signal,
          tenantId: event.tenantId,
          employeeId: event.employeeId,
          driverProfileId: driver.driverProfileId,
          date: event.date,
          busIds: driver.busIds,
        };
        this.logger.log(
          `Driver duty change: employee=${event.employeeId} status=${signal.status} legs=${signal.affectedLegs.join(',')} buses=${driver.busIds.length}`,
        );
        for (const listener of this.listeners) {
          await Promise.resolve()
            .then(() => listener(change))
            .catch((err) => this.logger.error(`Driver duty listener failed: ${String(err)}`));
        }
      });
    } catch (err) {
      this.logger.error(
        `Driver duty projection failed for employee ${event.employeeId} on ${event.date}: ${String(err)}`,
      );
    }
  }
}
