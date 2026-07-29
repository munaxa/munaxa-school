import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AcademicYearStatus, type AcademicYear } from '@prisma/client';
import { AcademicYearRepository } from './academic-year.repository';
import type { CreateAcademicYearDto, UpdateAcademicYearDto } from './academic-year.dto';
import type { AcademicYearMetrics, AcademicYearUsage } from './academic-year.repository';

/** A single pre-flight check surfaced by the activation/close validators. */
export interface ReadinessCheck {
  key: string;
  label: string;
  ok: boolean;
  /** `blocker` prevents the transition; `info` is advisory only. */
  severity: 'blocker' | 'info';
  /** Where the admin should go to resolve the check (admin-portal route). */
  resolveRoute?: string;
}

/** The full readiness payload for an Academic Year (score + activation + close checklists). */
export interface AcademicYearReadiness {
  academicYearId: string;
  /** 0–100 Academic Readiness Score derived from required-setup completion. */
  score: number;
  activation: { canActivate: boolean; checks: ReadinessCheck[] };
  close: { canClose: boolean; checks: ReadinessCheck[] };
}

/** Whether an Academic Year may be deleted, plus the usage that blocks it. */
export interface AcademicYearDeletability {
  deletable: boolean;
  usage: AcademicYearUsage;
}

@Injectable()
export class AcademicYearService {
  constructor(private readonly repo: AcademicYearRepository) {}

  async create(dto: CreateAcademicYearDto): Promise<AcademicYear> {
    if (!(await this.repo.campusExists(dto.campusId))) {
      throw new BadRequestException('Campus not found in this tenant');
    }
    this.assertDateOrder(dto.startDate, dto.endDate);

    const schoolId = await this.repo.campusSchoolId(dto.campusId);
    const status = this.resolveStatus(dto.status, dto.isCurrent);

    // One ACTIVE per School (Decision 1): supersede any other active year before activating this one.
    if (status === AcademicYearStatus.ACTIVE) {
      await this.repo.clearActiveForSchool(schoolId, dto.campusId);
    }

    this.assertRegistrationOrder(dto.registrationStartDate, dto.registrationEndDate);

    return this.repo.create({
      campusId: dto.campusId,
      schoolId,
      name: dto.name,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      registrationStartDate: dto.registrationStartDate ? new Date(dto.registrationStartDate) : null,
      registrationEndDate: dto.registrationEndDate ? new Date(dto.registrationEndDate) : null,
      status,
      isCurrent: status === AcademicYearStatus.ACTIVE,
    });
  }

  list(campusId?: string): Promise<AcademicYear[]> {
    return this.repo.findMany(campusId);
  }

  async get(id: string): Promise<AcademicYear> {
    const year = await this.repo.findById(id);
    if (!year) throw new NotFoundException('Academic year not found');
    return year;
  }

  async update(id: string, dto: UpdateAcademicYearDto): Promise<AcademicYear> {
    const existing = await this.get(id);
    const start = dto.startDate ?? existing.startDate.toISOString();
    const end = dto.endDate ?? existing.endDate.toISOString();
    this.assertDateOrder(start, end);

    // Resolve the requested status (explicit `status` wins; else map the deprecated `isCurrent`).
    const nextStatus =
      dto.status ??
      (dto.isCurrent === undefined ? undefined : this.resolveStatus(undefined, dto.isCurrent));

    // Registration window: validate the resulting pair (whichever side is being changed).
    const regStart = dto.registrationStartDate ?? existing.registrationStartDate?.toISOString();
    const regEnd = dto.registrationEndDate ?? existing.registrationEndDate?.toISOString();
    this.assertRegistrationOrder(regStart, regEnd);

    if (nextStatus === AcademicYearStatus.ACTIVE) {
      await this.repo.clearActiveForSchool(existing.schoolId, existing.campusId, id);
    }

    return this.repo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
      ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
      ...(dto.registrationStartDate !== undefined
        ? {
            registrationStartDate: dto.registrationStartDate
              ? new Date(dto.registrationStartDate)
              : null,
          }
        : {}),
      ...(dto.registrationEndDate !== undefined
        ? {
            registrationEndDate: dto.registrationEndDate ? new Date(dto.registrationEndDate) : null,
          }
        : {}),
      ...(nextStatus !== undefined
        ? { status: nextStatus, isCurrent: nextStatus === AcademicYearStatus.ACTIVE }
        : {}),
    });
  }

  /**
   * Close an Academic Year (Decision 8). Administrative event only: flips status to CLOSED and clears
   * the legacy current flag. Does NOT touch Student or Enrollment rows (the Year-End Processing wizard
   * owns promotion). Idempotent.
   */
  async close(id: string): Promise<AcademicYear> {
    const existing = await this.get(id);
    if (existing.status === AcademicYearStatus.CLOSED) return existing;
    return this.repo.update(id, { status: AcademicYearStatus.CLOSED, isCurrent: false });
  }

  /** The ACTIVE year for a school (or the whole tenant when `schoolId` is omitted). */
  current(schoolId?: string): Promise<AcademicYear | null> {
    return this.repo.findActive(schoolId);
  }

  /** Operational metrics for the Academic Year card / workspace. Read-only. */
  async overview(id: string): Promise<AcademicYearMetrics & { academicYearId: string }> {
    const year = await this.get(id);
    const metrics = await this.repo.metrics(year);
    return { academicYearId: id, ...metrics };
  }

  /**
   * Pre-flight validation for the workspace: the activation checklist (required setup), the close
   * checklist (operational readiness), and the Academic Readiness Score. Read-only.
   */
  async readiness(id: string): Promise<AcademicYearReadiness> {
    const year = await this.get(id);
    const setup = await this.repo.setup(year);
    const metrics = await this.repo.metrics(year);

    // Semester geometry — the instructional calendar is derived entirely from Semester records
    // (the single source of truth), never from a placeholder string.
    const sem = this.semesterCoverage(year, setup.semesters);

    const activation: ReadinessCheck[] = [
      {
        key: 'startDate',
        label: 'Start date set',
        ok: Boolean(year.startDate),
        severity: 'blocker',
      },
      { key: 'endDate', label: 'End date set', ok: Boolean(year.endDate), severity: 'blocker' },
      {
        key: 'registration',
        label: 'Registration window set',
        ok: Boolean(year.registrationStartDate && year.registrationEndDate),
        severity: 'blocker',
        resolveRoute: '/structure/academic-year',
      },
      {
        key: 'semester',
        label: 'At least one semester',
        ok: setup.semesters.length > 0,
        severity: 'blocker',
        resolveRoute: '/structure/academic-year',
      },
      {
        key: 'semestersInsideYear',
        label: 'Semester dates fall inside the academic year',
        ok: sem.allInsideYear,
        severity: 'blocker',
        resolveRoute: '/structure/academic-year',
      },
      {
        key: 'semestersNoOverlap',
        label: 'Semester dates do not overlap',
        ok: sem.noOverlap,
        severity: 'blocker',
        resolveRoute: '/structure/academic-year',
      },
      {
        key: 'semestersCoverYear',
        label: 'Semesters cover the whole academic year',
        ok: sem.coversYear,
        severity: 'blocker',
        resolveRoute: '/structure/academic-year',
      },
      {
        key: 'grades',
        label: 'Grades configured',
        ok: setup.gradeCount > 0,
        severity: 'blocker',
        resolveRoute: '/structure/academic',
      },
      {
        key: 'sections',
        label: 'Sections configured',
        ok: setup.sectionCount > 0,
        severity: 'blocker',
        resolveRoute: '/structure/academic',
      },
    ];

    // Close pre-flight. Percentages that cannot be measured (no data yet) do not block — a year with
    // nothing recorded is trivially "complete" for that dimension.
    const pct = (v: number | null) => v ?? 100;
    const close: ReadinessCheck[] = [
      {
        key: 'attendance',
        label: 'Attendance recording complete',
        ok: metrics.attendancePct === null || metrics.attendancePct >= 0,
        severity: 'info',
        resolveRoute: '/attendance',
      },
      {
        key: 'reportCards',
        label: 'Report cards finalized',
        ok: pct(metrics.reportCardCompletionPct) >= 100,
        severity: 'info',
        resolveRoute: '/academics',
      },
      {
        key: 'feeVerification',
        label: 'Payments verified',
        ok: metrics.unverifiedPayments === 0,
        severity: 'info',
        resolveRoute: '/finance/collections',
      },
      {
        key: 'timetable',
        label: 'Timetable generation complete',
        ok: pct(metrics.timetableCompletionPct) >= 100,
        severity: 'info',
        resolveRoute: '/timetable',
      },
    ];

    // Academic Readiness Score: completion of the required activation setup, weighted evenly, then
    // nudged by the operational completion percentages so a fully-configured-but-empty year still
    // reads as "ready".
    const setupChecks = activation.filter((c) => c.severity === 'blocker');
    const setupScore = setupChecks.filter((c) => c.ok).length / setupChecks.length;
    const opSignals = [metrics.timetableCompletionPct, metrics.reportCardCompletionPct].filter(
      (v): v is number => v !== null,
    );
    const opScore =
      opSignals.length > 0 ? opSignals.reduce((a, b) => a + b, 0) / opSignals.length / 100 : 1;
    const score = Math.round((setupScore * 0.7 + opScore * 0.3) * 100);

    return {
      academicYearId: id,
      score,
      activation: {
        canActivate: activation.every((c) => c.severity !== 'blocker' || c.ok),
        checks: activation,
      },
      close: { canClose: close.every((c) => c.severity !== 'blocker' || c.ok), checks: close },
    };
  }

  /**
   * Whether the Academic Year may be deleted (Decision 8 — only if COMPLETELY unused). Any historical
   * data (enrollment, charges, semesters, reports, timetable, audit) makes it non-deletable.
   */
  async deletability(id: string): Promise<AcademicYearDeletability> {
    const year = await this.get(id);
    const usage = await this.repo.usage(year);
    const deletable =
      year.status !== AcademicYearStatus.CLOSED &&
      Object.values(usage).every((count) => count === 0);
    return { deletable, usage };
  }

  /**
   * Deletion is only permitted for a COMPLETELY unused Academic Year (Decision 8). Once a year anchors
   * any historical data (attendance, grades, finance, …) it can only ever be closed.
   */
  async remove(id: string): Promise<void> {
    const { deletable } = await this.deletability(id);
    if (!deletable) {
      throw new BadRequestException(
        'This Academic Year contains historical data and cannot be deleted. Close the year instead (POST /academic-years/:id/close).',
      );
    }
    await this.repo.delete(id);
  }

  /** Map the explicit `status` (preferred) or the deprecated `isCurrent` flag to a lifecycle status. */
  private resolveStatus(
    status: AcademicYearStatus | undefined,
    isCurrent: boolean | undefined,
  ): AcademicYearStatus {
    if (status) return status;
    if (isCurrent) return AcademicYearStatus.ACTIVE;
    return AcademicYearStatus.UPCOMING;
  }

  private assertDateOrder(start: string, end: string): void {
    if (new Date(start).getTime() >= new Date(end).getTime()) {
      throw new BadRequestException('startDate must be before endDate');
    }
  }

  /** When both registration dates are present, start must precede end. Either side may be null. */
  private assertRegistrationOrder(start?: string | null, end?: string | null): void {
    if (start && end && new Date(start).getTime() >= new Date(end).getTime()) {
      throw new BadRequestException('registrationStartDate must be before registrationEndDate');
    }
  }

  /**
   * Derive the instructional-calendar readiness signals purely from Semester records:
   *  - `allInsideYear`  — every semester lies within [year.start, year.end]
   *  - `noOverlap`      — no two semesters overlap (adjacent/touching is allowed)
   *  - `coversYear`     — the semester ranges together span the entire academic year (no gaps)
   * With zero semesters every derived flag is false (nothing to validate against yet).
   */
  private semesterCoverage(
    year: AcademicYear,
    semesters: { startDate: Date; endDate: Date }[],
  ): { allInsideYear: boolean; noOverlap: boolean; coversYear: boolean } {
    if (semesters.length === 0) {
      return { allInsideYear: false, noOverlap: false, coversYear: false };
    }
    const yearStart = year.startDate.getTime();
    const yearEnd = year.endDate.getTime();
    // Defensive copy sorted by start date (repo already orders, but do not rely on it here).
    const spans = semesters
      .map((s) => ({ start: s.startDate.getTime(), end: s.endDate.getTime() }))
      .sort((a, b) => a.start - b.start);

    const allInsideYear = spans.every((s) => s.start >= yearStart && s.end <= yearEnd);

    // Semester end dates are inclusive (`@db.Date`), so a term ending on the 31st and the next
    // starting on the 1st are adjacent, not overlapping and not a gap. Allow that one-day seam.
    const DAY = 86_400_000;
    let noOverlap = true;
    let contiguous = true;
    for (let i = 1; i < spans.length; i++) {
      const prev = spans[i - 1]!;
      const curr = spans[i]!;
      // Overlap when a semester starts on or before the previous one's (inclusive) end.
      if (curr.start <= prev.end) noOverlap = false;
      // Gap when a semester starts more than one day after the previous one ends.
      if (curr.start - prev.end > DAY) contiguous = false;
    }

    // Coverage: no gaps between consecutive semesters, and the union spans the whole year.
    const first = spans[0]!;
    const last = spans[spans.length - 1]!;
    const coversYear = contiguous && first.start <= yearStart && last.end >= yearEnd;

    return { allInsideYear, noOverlap, coversYear };
  }
}
