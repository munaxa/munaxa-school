import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AttendanceSourceConfig,
  BusAttendanceEvent,
  StudentPresenceEvent,
} from '@prisma/client';
import { PresenceRepository, type TimelineItem } from './presence.repository';
import { IdentificationRegistry } from './identification/student-identification.provider';
import type {
  CreateBusEventDto,
  CreatePresenceEventDto,
  UpdateAttendanceSettingsDto,
} from './presence.dto';

/**
 * Campus Presence + Transportation services (Phase 21). Separate from Academic Attendance; the
 * only attendance write is the guarded, non-overwriting `maybeMarkPresent` invoked by the
 * configurable attendance-source engine.
 */
@Injectable()
export class PresenceService {
  constructor(
    private readonly repo: PresenceRepository,
    private readonly identification: IdentificationRegistry,
  ) {}

  /**
   * Resolve the subject student: an explicit studentId, or a card UID via the matching
   * identification provider (NFC/RFID resolve ACTIVE cards only; QR resolves the printed code).
   */
  private async resolveStudentId(
    studentId: string | undefined,
    cardUid: string | undefined,
    method: string,
  ): Promise<string> {
    if (studentId) return studentId;
    if (!cardUid) throw new BadRequestException('Provide either studentId or cardUid');
    const provider = this.identification.get(method) ?? this.identification.get('NFC')!;
    const resolved = await provider.resolve(cardUid);
    if (!resolved) {
      throw new BadRequestException('Card not recognised or not active');
    }
    return resolved;
  }

  // ----------------------------------------------------------- settings

  async getSettings(): Promise<AttendanceSourceConfig> {
    const cfg = await this.repo.getConfig();
    return (
      cfg ?? {
        id: '',
        tenantId: '',
        mode: 'TEACHER_ONLY',
        busMethod: 'NFC',
        presenceEnabled: false,
        transportEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );
  }

  updateSettings(dto: UpdateAttendanceSettingsDto): Promise<AttendanceSourceConfig> {
    return this.repo.upsertConfig({
      ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
      ...(dto.busMethod !== undefined ? { busMethod: dto.busMethod } : {}),
      ...(dto.presenceEnabled !== undefined ? { presenceEnabled: dto.presenceEnabled } : {}),
      ...(dto.transportEnabled !== undefined ? { transportEnabled: dto.transportEnabled } : {}),
    });
  }

  // -------------------------------------------------- attendance-source engine

  /** Decide whether an arrival event should auto-create a PRESENT mark, per tenant config. */
  private async runSourceEngine(
    kind: 'GATE_IN' | 'ARRIVE_SCHOOL',
    studentId: string,
    at: Date,
  ): Promise<void> {
    const cfg = await this.repo.getConfig();
    const mode = cfg?.mode ?? 'TEACHER_ONLY';
    const shouldMark =
      (kind === 'GATE_IN' && (mode === 'GATE_ARRIVAL' || mode === 'HYBRID')) ||
      (kind === 'ARRIVE_SCHOOL' && (mode === 'BUS_ARRIVAL' || mode === 'HYBRID'));
    if (shouldMark) await this.repo.maybeMarkPresent(studentId, at);
  }

  // ----------------------------------------------------------- presence

  async createPresence(
    dto: CreatePresenceEventDto,
  ): Promise<{ event: StudentPresenceEvent; created: boolean }> {
    const method = dto.method ?? 'MANUAL';
    const studentId = await this.resolveStudentId(dto.studentId, dto.cardUid, method);
    if (!(await this.repo.studentExists(studentId))) {
      throw new BadRequestException('Student not found in this tenant');
    }
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const result = await this.repo.createPresenceEvent({
      studentId,
      eventType: dto.eventType,
      method,
      occurredAt,
      deviceId: dto.deviceId ?? null,
      clientRef: dto.clientRef ?? null,
    });
    // Only run the engine for a freshly-created GATE_IN (idempotent replays don't re-trigger).
    if (result.created && dto.eventType === 'GATE_IN') {
      await this.runSourceEngine('GATE_IN', studentId, occurredAt);
    }
    return result;
  }

  listPresence(studentId: string | undefined, take = 100): Promise<StudentPresenceEvent[]> {
    return this.repo.listPresence({ ...(studentId ? { studentId } : {}), take });
  }

  // ---------------------------------------------------------- transport

  async createBus(
    dto: CreateBusEventDto,
  ): Promise<{ event: BusAttendanceEvent; created: boolean }> {
    const method = dto.method ?? 'NFC';
    const studentId = await this.resolveStudentId(dto.studentId, dto.cardUid, method);
    if (!(await this.repo.studentExists(studentId))) {
      throw new BadRequestException('Student not found in this tenant');
    }
    if (!(await this.repo.busExists(dto.busId))) {
      throw new BadRequestException('Bus not found in this tenant');
    }
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const result = await this.repo.createBusEvent({
      studentId,
      busId: dto.busId,
      eventType: dto.eventType,
      method,
      occurredAt,
      clientRef: dto.clientRef ?? null,
    });
    if (result.created && dto.eventType === 'ARRIVE_SCHOOL') {
      await this.runSourceEngine('ARRIVE_SCHOOL', studentId, occurredAt);
    }
    return result;
  }

  listBus(studentId: string | undefined, take = 100): Promise<BusAttendanceEvent[]> {
    return this.repo.listBus({ ...(studentId ? { studentId } : {}), take });
  }

  // ----------------------------------------------------------- timeline

  async timeline(studentId: string, take = 100): Promise<TimelineItem[]> {
    if (!(await this.repo.studentExists(studentId))) {
      throw new BadRequestException('Student not found in this tenant');
    }
    return this.repo.timeline(studentId, take);
  }
}
