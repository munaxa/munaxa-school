import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StaffAttendanceSource, type StaffAttendanceStatus } from '@prisma/client';
import { AttendanceRepository, type StaffAttendanceView } from './attendance.repository';
import { DomainEvents } from '../../events/domain-events';
import { TenantContextStore } from '../../prisma/tenant-context';
import { staffAttendanceRecordedEvent } from './staff-attendance-events';
import { AttendanceLockService } from './lock/attendance-lock.service';
import { WorkingDayCalendarService } from '../../scheduling/calendar/working-day-calendar.service';
import { validatePayrollPeriod, type ValidationResult } from './payroll-validation.logic';
import { workingDaysBetween } from '../leave/leave-days.logic';
import {
  overlapWorkingDays,
  summarizeAttendance,
  type AttendanceDayInput,
  type PayrollPrepSummary,
} from './payroll-prep.logic';
import type { ReportTable } from '../../reporting/export/report.types';
import type {
  BulkAttendanceDto,
  ListAttendanceQueryDto,
  PayrollPrepQueryDto,
  RecordAttendanceDto,
} from './attendance.dto';

export interface PayrollPrepRow extends PayrollPrepSummary {
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
}

export interface PayrollPrepResult {
  from: string;
  to: string;
  workingDays: number;
  rows: PayrollPrepRow[];
}

/** Parse an ISO date (YYYY-MM-DD) into a UTC midnight Date, matching how `@db.Date` is stored. */
function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly repo: AttendanceRepository,
    private readonly events: DomainEvents,
    private readonly locks: AttendanceLockService,
    private readonly calendar: WorkingDayCalendarService,
  ) {}

  async record(employeeId: string, dto: RecordAttendanceDto): Promise<StaffAttendanceView> {
    await this.assertEmployee(employeeId);
    const date = parseDate(dto.date);
    // A locked day is immutable: edits must go through the correction workflow (N3/N4).
    await this.locks.assertWritable(date);
    const source = dto.source ?? StaffAttendanceSource.MANUAL;
    const { view, previousStatus } = await this.repo.record(employeeId, date, {
      status: dto.status,
      source,
      ...(dto.checkInAt !== undefined ? { checkInAt: new Date(dto.checkInAt) } : {}),
      ...(dto.checkOutAt !== undefined ? { checkOutAt: new Date(dto.checkOutAt) } : {}),
      ...(dto.lateMinutes !== undefined ? { lateMinutes: dto.lateMinutes } : {}),
      ...(dto.overtimeHours !== undefined ? { overtimeHours: dto.overtimeHours } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
    });
    this.publishRecorded(employeeId, dto.date, dto.status, source, previousStatus);
    return view;
  }

  async bulk(dto: BulkAttendanceDto): Promise<{ count: number }> {
    const date = parseDate(dto.date);
    await this.locks.assertWritable(date);
    const source = dto.source ?? StaffAttendanceSource.MANUAL;
    const results = await this.repo.bulkRecord(
      date,
      source,
      dto.entries.map((e) => ({
        employeeId: e.employeeId,
        status: e.status,
        ...(e.lateMinutes !== undefined ? { lateMinutes: e.lateMinutes } : {}),
        ...(e.overtimeHours !== undefined ? { overtimeHours: e.overtimeHours } : {}),
        ...(e.note !== undefined ? { note: e.note } : {}),
      })),
    );
    for (const r of results) {
      this.publishRecorded(r.employeeId, dto.date, r.status, r.source, r.previousStatus);
    }
    return { count: results.length };
  }

  /**
   * Record a day whose status was **derived** by the shift + policy engines (biometric ingestion).
   *
   * Unlike a correction this is an ordinary write, so the lock guard applies: a device batch can
   * never silently rewrite a sealed payroll period. Everything else (correction trail, audit,
   * integration event) is the canonical path.
   */
  async recordDerived(
    employeeId: string,
    date: Date,
    data: {
      status: StaffAttendanceStatus;
      source: StaffAttendanceSource;
      checkInAt?: Date | null;
      checkOutAt?: Date | null;
      lateMinutes?: number | null;
      overtimeHours?: number | null;
    },
  ): Promise<StaffAttendanceView> {
    await this.locks.assertWritable(date);
    const { view, previousStatus } = await this.repo.record(employeeId, date, {
      status: data.status,
      source: data.source,
      ...(data.checkInAt !== undefined ? { checkInAt: data.checkInAt } : {}),
      ...(data.checkOutAt !== undefined ? { checkOutAt: data.checkOutAt } : {}),
      ...(data.lateMinutes !== undefined ? { lateMinutes: data.lateMinutes } : {}),
      ...(data.overtimeHours !== undefined ? { overtimeHours: data.overtimeHours } : {}),
    });
    this.publishRecorded(
      employeeId,
      date.toISOString().slice(0, 10),
      data.status,
      data.source,
      previousStatus,
    );
    return view;
  }

  /**
   * Apply an **approved** attendance correction (N4).
   *
   * This is the only sanctioned way to change a locked day: the lock guard is intentionally not
   * applied here because the correction workflow — request, review, approval, audit — is the
   * control that replaces it. The write still goes through the canonical repository path, so the
   * existing correction trail (`correctedFromStatus`/`correctedById`/`correctedAt`), the audit
   * entry and the integration event all behave exactly as for any other write.
   */
  async applyApprovedCorrection(
    employeeId: string,
    date: Date,
    data: {
      status: StaffAttendanceStatus;
      checkInAt?: Date | null;
      checkOutAt?: Date | null;
      note?: string | null;
    },
  ): Promise<StaffAttendanceView> {
    const source = StaffAttendanceSource.MANUAL;
    const { view, previousStatus } = await this.repo.record(employeeId, date, {
      status: data.status,
      source,
      ...(data.checkInAt !== undefined ? { checkInAt: data.checkInAt } : {}),
      ...(data.checkOutAt !== undefined ? { checkOutAt: data.checkOutAt } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
    });
    this.publishRecorded(
      employeeId,
      date.toISOString().slice(0, 10),
      data.status,
      source,
      previousStatus,
    );
    return view;
  }

  /**
   * Publish the `StaffAttendanceRecorded` integration fact post-commit. Fire-and-forget: the bus
   * isolates handlers, so a downstream consumer never affects the write. No-op when there is no
   * tenant context (defensive; the write path always runs inside one).
   */
  private publishRecorded(
    employeeId: string,
    date: string,
    status: StaffAttendanceStatus,
    source: StaffAttendanceSource,
    previousStatus: StaffAttendanceStatus | null,
  ): void {
    const tenantId = TenantContextStore.getTenantId();
    if (!tenantId) return;
    this.events.emit(
      staffAttendanceRecordedEvent({ tenantId, employeeId, date, status, source, previousStatus }),
    );
  }

  async listForEmployee(
    employeeId: string,
    query: ListAttendanceQueryDto,
  ): Promise<StaffAttendanceView[]> {
    await this.assertEmployee(employeeId);
    return this.repo.listForEmployee(
      employeeId,
      query.from ? parseDate(query.from) : undefined,
      query.to ? parseDate(query.to) : undefined,
    );
  }

  listForDate(date: string): Promise<StaffAttendanceView[]> {
    return this.repo.listForDate(parseDate(date));
  }

  // ----- Payroll preparation ------------------------------------------------
  async payrollPrep(query: PayrollPrepQueryDto): Promise<PayrollPrepResult> {
    const from = parseDate(query.from);
    const to = parseDate(query.to);
    if (to < from) throw new BadRequestException('`to` must be on or after `from`');

    // Calendar-aware since PR-2/2b: school-wide holidays come from Scheduling (the canonical owner)
    // through the injected port, so leave and payroll can never disagree about a working day.
    const calendar = await this.calendar.forRange(from, to);
    const workingDays = workingDaysBetween(from, to, calendar);
    const [employees, attendance, leave] = await Promise.all([
      this.repo.listActiveEmployees(),
      this.repo.attendanceInRange(from, to),
      this.repo.approvedLeaveInRange(from, to),
    ]);

    // Group attendance + leave coverage by employee.
    const daysByEmployee = new Map<string, AttendanceDayInput[]>();
    for (const row of attendance) {
      const list = daysByEmployee.get(row.employeeId) ?? [];
      list.push({
        status: row.status,
        lateMinutes: row.lateMinutes,
        overtimeHours: row.overtimeHours === null ? null : Number(row.overtimeHours),
      });
      daysByEmployee.set(row.employeeId, list);
    }

    const leaveByEmployee = new Map<string, { paidLeaveDays: number; unpaidLeaveDays: number }>();
    for (const span of leave) {
      const days = overlapWorkingDays(from, to, span.startDate, span.endDate, calendar);
      if (days <= 0) continue;
      const acc = leaveByEmployee.get(span.employeeId) ?? { paidLeaveDays: 0, unpaidLeaveDays: 0 };
      if (span.paid) acc.paidLeaveDays += days;
      else acc.unpaidLeaveDays += days;
      leaveByEmployee.set(span.employeeId, acc);
    }

    const rows: PayrollPrepRow[] = employees.map((emp) => {
      const summary = summarizeAttendance(
        workingDays,
        daysByEmployee.get(emp.id) ?? [],
        leaveByEmployee.get(emp.id) ?? { paidLeaveDays: 0, unpaidLeaveDays: 0 },
      );
      return {
        employeeId: emp.id,
        employeeName: `${emp.firstNameEn} ${emp.lastNameEn}`,
        employeeNumber: emp.employeeNumber,
        ...summary,
      };
    });

    return { from: query.from.slice(0, 10), to: query.to.slice(0, 10), workingDays, rows };
  }

  /**
   * Payroll **validation** (PR-13) — the gate between preparation and the payroll run.
   *
   * Proves the period is safe to hand over: fully locked (attendance can no longer move) and free of
   * undecided corrections. Returns the same preparation payload plus the verdict, so payroll
   * consumes one clean contract. Money is still never computed here.
   */
  async payrollPrepValidated(
    query: PayrollPrepQueryDto,
  ): Promise<PayrollPrepResult & { validation: ValidationResult }> {
    const from = parseDate(query.from);
    const to = parseDate(query.to);
    const [result, locks, pendingCorrections] = await Promise.all([
      this.payrollPrep(query),
      this.locks.activeCovering(from, to),
      this.repo.countPendingCorrections(from, to),
    ]);

    // Fully locked ⇔ no writable day remains in the range.
    const periodFullyLocked =
      locks.length > 0 && !(await this.locks.isRangeWritable(from, to, null));

    const validation = validatePayrollPeriod({
      periodFullyLocked,
      pendingCorrections,
      missingAttendanceDays: 0,
      unresolvedPunches: await this.repo.countUnprocessedPunches(from, to),
    });
    return { ...result, validation };
  }

  /** Build a generic {@link ReportTable} of a payroll-prep result for CSV/xlsx/pdf export. */
  toReportTable(result: PayrollPrepResult): ReportTable {
    return {
      title: 'Payroll preparation',
      subtitle: `${result.from} → ${result.to} · ${result.workingDays} working days`,
      columns: [
        { key: 'employeeNumber', header: 'Employee #' },
        { key: 'employeeName', header: 'Name' },
        { key: 'workingDays', header: 'Working days' },
        { key: 'presentDays', header: 'Present' },
        { key: 'remoteDays', header: 'Remote' },
        { key: 'absentDays', header: 'Absent' },
        { key: 'lateDays', header: 'Late' },
        { key: 'lateMinutes', header: 'Late minutes' },
        { key: 'overtimeHours', header: 'Overtime hours' },
        { key: 'paidLeaveDays', header: 'Paid leave' },
        { key: 'unpaidLeaveDays', header: 'Unpaid leave' },
        { key: 'payableDays', header: 'Payable days' },
      ],
      rows: result.rows.map((r) => ({
        employeeNumber: r.employeeNumber ?? '',
        employeeName: r.employeeName,
        workingDays: r.workingDays,
        presentDays: r.presentDays,
        remoteDays: r.remoteDays,
        absentDays: r.absentDays,
        lateDays: r.lateDays,
        lateMinutes: r.lateMinutes,
        overtimeHours: r.overtimeHours,
        paidLeaveDays: r.paidLeaveDays,
        unpaidLeaveDays: r.unpaidLeaveDays,
        payableDays: r.payableDays,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private async assertEmployee(employeeId: string) {
    if (!(await this.repo.employeeExists(employeeId))) {
      throw new NotFoundException('Employee not found');
    }
  }
}
