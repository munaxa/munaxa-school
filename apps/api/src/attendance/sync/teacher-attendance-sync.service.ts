import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { StaffAttendanceStatus } from '@prisma/client';
import { DomainEvents, type DomainEvent } from '../../events/domain-events';
import { TenantContextStore } from '../../prisma/tenant-context';
import { TeacherAttendanceRepository } from '../teachers/teacher-attendance.repository';
import { TeacherLinkRepository } from './teacher-link.repository';
import { projectStaffStatusToTeacherStatus } from './staff-attendance-projection';

/**
 * HR → Academics teacher-attendance synchronisation (PR-5).
 *
 * Subscribes to the canonical domain-event bus and projects `StaffAttendanceRecorded` facts onto
 * `TeacherAttendance` **when, and only when, the employee is linked to a Teacher**. This is the
 * decoupling seam required by the architecture: HR never imports Academics and Academics never
 * imports HR — they meet at the event bus.
 *
 * Properties:
 * - **Idempotent** — the underlying write is an upsert on (tenant, teacher, date), so redelivering
 *   the same event converges to the same row.
 * - **Isolated** — the bus swallows handler errors, so a projection failure never breaks the HR
 *   write that produced the event. Failures are logged for reconciliation.
 * - **Tenant-safe** — the handler runs outside any HTTP request, so it re-establishes the tenant
 *   context from the event payload before touching the database (RLS still applies).
 */
@Injectable()
export class TeacherAttendanceSyncService implements OnModuleInit {
  private readonly logger = new Logger(TeacherAttendanceSyncService.name);

  constructor(
    private readonly events: DomainEvents,
    private readonly links: TeacherLinkRepository,
    private readonly teacherAttendance: TeacherAttendanceRepository,
  ) {}

  onModuleInit(): void {
    this.events.subscribe((event) => this.handle(event));
  }

  /** Handle one domain event. Non-attendance events are ignored. */
  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== 'StaffAttendanceRecorded') return;

    const status = projectStaffStatusToTeacherStatus(event.status as StaffAttendanceStatus);
    // HOLIDAY (or an unmapped status) produces no academic record at all.
    if (status === null) return;

    try {
      await TenantContextStore.run({ tenantId: event.tenantId }, async () => {
        const teacherId = await this.links.teacherIdForEmployee(event.employeeId);
        // Not every employee teaches; non-teaching staff simply have no academic projection.
        if (!teacherId) return;

        await this.teacherAttendance.upsert({
          teacherId,
          date: new Date(`${event.date}T00:00:00.000Z`),
          status,
          checkInAt: null,
          note: `Synced from HR staff attendance (${event.status})`,
          markedById: null,
        });
      });
    } catch (err) {
      // Never rethrow: a projection failure must not affect the HR write or sibling subscribers.
      this.logger.error(
        `Teacher-attendance projection failed for employee ${event.employeeId} on ${event.date}: ${String(err)}`,
      );
    }
  }
}
