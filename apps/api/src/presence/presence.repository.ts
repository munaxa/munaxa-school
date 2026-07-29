import { Injectable } from '@nestjs/common';
import {
  type AttendanceSourceConfig,
  type BusAttendanceEvent,
  type StudentPresenceEvent,
} from '@prisma/client';
import { TenantRepository } from '../common/tenant.repository';
import { TenantContextStore } from '../prisma/tenant-context';

export interface TimelineItem {
  at: string; // ISO timestamp
  source: 'ATTENDANCE' | 'PRESENCE' | 'BUS';
  kind: string; // event/status code
  label: string;
}

@Injectable()
export class PresenceRepository extends TenantRepository {
  studentExists(studentId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.student.findFirst({ where: { id: studentId, deletedAt: null } })) !== null,
    );
  }

  busExists(busId: string): Promise<boolean> {
    return this.run(async (tx) => (await tx.bus.findFirst({ where: { id: busId } })) !== null);
  }

  // ---------------------------------------------------------------- config

  getConfig(): Promise<AttendanceSourceConfig | null> {
    return this.run((tx, tenantId) =>
      tx.attendanceSourceConfig.findUnique({ where: { tenantId } }),
    );
  }

  upsertConfig(
    data: Partial<
      Pick<AttendanceSourceConfig, 'mode' | 'busMethod' | 'presenceEnabled' | 'transportEnabled'>
    >,
  ): Promise<AttendanceSourceConfig> {
    return this.run(async (tx, tenantId) => {
      const config = await tx.attendanceSourceConfig.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'attendance.source.config',
        entityType: 'AttendanceSourceConfig',
        entityId: config.id,
        metadata: { ...data },
      });
      return config;
    });
  }

  // ------------------------------------------------------- presence events

  /** Idempotent on (tenantId, clientRef): replaying the same queued event returns the same row. */
  createPresenceEvent(data: {
    studentId: string;
    eventType: StudentPresenceEvent['eventType'];
    method: StudentPresenceEvent['method'];
    occurredAt: Date;
    deviceId: string | null;
    clientRef: string | null;
  }): Promise<{ event: StudentPresenceEvent; created: boolean }> {
    return this.run(async (tx, tenantId) => {
      if (data.clientRef) {
        const existing = await tx.studentPresenceEvent.findUnique({
          where: { tenantId_clientRef: { tenantId, clientRef: data.clientRef } },
        });
        if (existing) return { event: existing, created: false };
      }
      const event = await tx.studentPresenceEvent.create({ data: { tenantId, ...data } });
      await this.writeAudit(tx, tenantId, {
        action: 'presence.event.create',
        entityType: 'StudentPresenceEvent',
        entityId: event.id,
        metadata: { studentId: data.studentId, eventType: data.eventType, method: data.method },
      });
      return { event, created: true };
    });
  }

  listPresence(filter: { studentId?: string; take: number }): Promise<StudentPresenceEvent[]> {
    return this.run((tx, tenantId) =>
      tx.studentPresenceEvent.findMany({
        where: { tenantId, ...(filter.studentId ? { studentId: filter.studentId } : {}) },
        orderBy: { occurredAt: 'desc' },
        take: filter.take,
      }),
    );
  }

  // ------------------------------------------------------------ bus events

  createBusEvent(data: {
    studentId: string;
    busId: string;
    eventType: BusAttendanceEvent['eventType'];
    method: BusAttendanceEvent['method'];
    occurredAt: Date;
    clientRef: string | null;
  }): Promise<{ event: BusAttendanceEvent; created: boolean }> {
    return this.run(async (tx, tenantId) => {
      if (data.clientRef) {
        const existing = await tx.busAttendanceEvent.findUnique({
          where: { tenantId_clientRef: { tenantId, clientRef: data.clientRef } },
        });
        if (existing) return { event: existing, created: false };
      }
      const event = await tx.busAttendanceEvent.create({ data: { tenantId, ...data } });
      await this.writeAudit(tx, tenantId, {
        action: 'transport.event.create',
        entityType: 'BusAttendanceEvent',
        entityId: event.id,
        metadata: { studentId: data.studentId, busId: data.busId, eventType: data.eventType },
      });
      return { event, created: true };
    });
  }

  listBus(filter: { studentId?: string; take: number }): Promise<BusAttendanceEvent[]> {
    return this.run((tx, tenantId) =>
      tx.busAttendanceEvent.findMany({
        where: { tenantId, ...(filter.studentId ? { studentId: filter.studentId } : {}) },
        orderBy: { occurredAt: 'desc' },
        take: filter.take,
      }),
    );
  }

  // ----------------------------------------- attendance-source engine write

  /**
   * Create a PRESENT mark from an arrival event **without overwriting** an existing mark.
   * Reuses the existing StudentAttendance table + natural unique key; the upsert `update` is a
   * no-op so a teacher's ABSENT/LATE/EXCUSED (or any prior mark) always wins. Returns false when
   * the student has no section (cannot create an attendance row) or a mark already existed.
   */
  maybeMarkPresent(studentId: string, occurredAt: Date): Promise<boolean> {
    return this.run(async (tx, tenantId) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, deletedAt: null },
        select: { sectionId: true },
      });
      if (!student?.sectionId) return false;
      const date = new Date(
        Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth(), occurredAt.getUTCDate()),
      );
      const existing = await tx.studentAttendance.findUnique({
        where: {
          tenantId_studentId_date_classNumber: { tenantId, studentId, date, classNumber: 0 },
        },
        select: { id: true },
      });
      if (existing) return false; // never overwrite an existing mark
      await tx.studentAttendance.create({
        data: {
          tenantId,
          studentId,
          sectionId: student.sectionId,
          date,
          classNumber: 0,
          status: 'PRESENT',
          method: 'MANUAL', // AttendanceMethod is unchanged (MANUAL/QR); arrival-derived = MANUAL
          markedById: TenantContextStore.get()?.actorUserId ?? null,
        },
      });
      return true;
    });
  }

  // -------------------------------------------------------------- timeline

  /** Chronological aggregation of attendance + presence + bus events for one student. */
  timeline(studentId: string, take: number): Promise<TimelineItem[]> {
    return this.run(async (tx, tenantId) => {
      const [attendance, presence, bus] = await Promise.all([
        tx.studentAttendance.findMany({
          where: { tenantId, studentId },
          orderBy: { recordedAt: 'desc' },
          take,
        }),
        tx.studentPresenceEvent.findMany({
          where: { tenantId, studentId },
          orderBy: { occurredAt: 'desc' },
          take,
        }),
        tx.busAttendanceEvent.findMany({
          where: { tenantId, studentId },
          orderBy: { occurredAt: 'desc' },
          take,
        }),
      ]);
      const items: TimelineItem[] = [
        ...attendance.map((a) => ({
          at: a.recordedAt.toISOString(),
          source: 'ATTENDANCE' as const,
          kind: a.status,
          label: `Homeroom ${a.status.toLowerCase()}`,
        })),
        ...presence.map((p) => ({
          at: p.occurredAt.toISOString(),
          source: 'PRESENCE' as const,
          kind: p.eventType,
          label: PRESENCE_LABEL[p.eventType] ?? p.eventType,
        })),
        ...bus.map((b) => ({
          at: b.occurredAt.toISOString(),
          source: 'BUS' as const,
          kind: b.eventType,
          label: BUS_LABEL[b.eventType] ?? b.eventType,
        })),
      ];
      // Chronological (most recent first); de-dup identical source+kind+timestamp.
      const seen = new Set<string>();
      return items
        .sort((x, y) => y.at.localeCompare(x.at))
        .filter((i) => {
          const key = `${i.source}|${i.kind}|${i.at}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, take);
    });
  }
}

const PRESENCE_LABEL: Record<string, string> = {
  GATE_IN: 'Gate entry',
  GATE_OUT: 'Left campus',
  RECEPTION_CHECKIN: 'Reception check-in',
  RECEPTION_CHECKOUT: 'Reception check-out',
};
const BUS_LABEL: Record<string, string> = {
  BOARD_AM: 'Boarded bus (AM)',
  ARRIVE_SCHOOL: 'Arrived school',
  BOARD_PM: 'Boarded bus (PM)',
  ARRIVE_HOME: 'Arrived home',
};
