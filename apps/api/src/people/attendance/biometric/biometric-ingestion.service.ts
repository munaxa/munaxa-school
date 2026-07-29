import { Injectable, Logger } from '@nestjs/common';
import { BiometricRepository } from './biometric.repository';
import { BiometricProviderRegistry } from './biometric-provider.registry';
import { AttendanceService } from '../attendance.service';
import { ShiftService } from '../shift/shift.service';
import { AttendancePolicyService } from '../policy/attendance-policy.service';
import { evaluateAttendance } from '../attendance-policy.logic';

export interface IngestResult {
  received: number;
  stored: number;
  resolved: number;
  unresolved: string[];
}

export interface ProcessResult {
  date: string;
  employeesProcessed: number;
  attendanceWritten: number;
  skippedNoShift: number;
}

/**
 * Biometric ingestion (N5) — the only bridge from devices to attendance.
 *
 * Two stages, deliberately separated so a device outage never loses data:
 *  1. **ingest** — normalise via the provider adapter and store raw punches idempotently.
 *  2. **process** — fold a date's punches into staff attendance, deriving status through the shift
 *     (N1) and policy (N2) engines, and writing via the canonical {@link AttendanceService} path so
 *     locks, the correction trail, audit and integration events all apply unchanged.
 *
 * Re-running either stage is safe: storage is idempotent on the provider's reference and the write
 * is an upsert on (employee, date).
 */
@Injectable()
export class BiometricIngestionService {
  private readonly logger = new Logger(BiometricIngestionService.name);

  constructor(
    private readonly repo: BiometricRepository,
    private readonly registry: BiometricProviderRegistry,
    private readonly attendance: AttendanceService,
    private readonly shifts: ShiftService,
    private readonly policies: AttendancePolicyService,
  ) {}

  /** Stage 1 — accept a provider payload, normalise it, resolve employees and store it. */
  async ingest(providerKey: string, payload: unknown): Promise<IngestResult> {
    const provider = this.registry.get(providerKey);
    const punches = provider.normalise(payload);

    // Resolve device user references to employees (by employee number) before storing.
    const refs = [...new Set(punches.map((p) => p.externalUserRef).filter(Boolean))];
    const byNumber = await this.repo.resolveEmployeesByNumber(refs);
    const unresolved: string[] = [];
    for (const punch of punches) {
      const employeeId = punch.employeeId ?? byNumber.get(punch.externalUserRef) ?? null;
      punch.employeeId = employeeId;
      if (!employeeId) unresolved.push(punch.externalUserRef);
    }

    const stored = await this.repo.storeBatch(provider.key, punches);
    const resolved = punches.filter((p) => p.employeeId).length;
    if (unresolved.length > 0) {
      // Retained (not dropped) so they can be reconciled once the employee record exists.
      this.logger.warn(
        `Biometric ingest: ${unresolved.length} punch(es) could not be matched to an employee`,
      );
    }
    return { received: punches.length, stored, resolved, unresolved: [...new Set(unresolved)] };
  }

  /**
   * Stage 2 — turn a date's stored punches into attendance rows.
   *
   * An employee with no assigned shift is skipped rather than guessed at: without expected times
   * there is no defensible status, and inventing one would corrupt payroll.
   */
  async process(dateIso: string): Promise<ProcessResult> {
    const date = new Date(`${dateIso.slice(0, 10)}T00:00:00.000Z`);
    const windows = await this.repo.pendingWindows(date);
    const policy = await this.policies.resolveConfig(null);

    let attendanceWritten = 0;
    let skippedNoShift = 0;
    const processed: string[] = [];

    for (const window of windows) {
      const measurement = await this.shifts.measure(window.employeeId, date, {
        checkInAt: window.checkInAt,
        checkOutAt: window.checkOutAt,
      });
      if (!measurement) {
        skippedNoShift += 1;
        continue;
      }
      const verdict = evaluateAttendance(measurement, policy);
      await this.attendance.recordDerived(window.employeeId, date, {
        status: verdict.status,
        source: 'BIOMETRIC',
        checkInAt: window.checkInAt,
        checkOutAt: window.checkOutAt,
        lateMinutes: verdict.effectiveLateMinutes,
        overtimeHours: round2(verdict.overtimeMinutes / 60),
      });
      attendanceWritten += 1;
      processed.push(window.employeeId);
    }

    await this.repo.markProcessed(date, processed);
    return {
      date: dateIso.slice(0, 10),
      employeesProcessed: windows.length,
      attendanceWritten,
      skippedNoShift,
    };
  }

  /** Registered provider keys (for the admin UI / integration docs). */
  providers(): string[] {
    return this.registry.keys();
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
