import { BadRequestException } from '@nestjs/common';
import { AcademicYearStatus, type AcademicYear } from '@prisma/client';
import { AcademicYearService } from './academic-year.service';
import type { AcademicYearRepository } from './academic-year.repository';

const YEAR = {
  id: 'ay1',
  campusId: 'c1',
  schoolId: 's1',
  name: '2025/2026',
  startDate: new Date('2025-09-01'),
  endDate: new Date('2026-06-30'),
  status: AcademicYearStatus.UPCOMING,
  isCurrent: false,
} as AcademicYear;

const EMPTY_USAGE = {
  enrollments: 0,
  charges: 0,
  semesters: 0,
  reports: 0,
  timetable: 0,
  auditLogs: 0,
};

/** Build a service with stubbed repo functions exposed for assertions. */
function setup(
  opts: {
    found?: AcademicYear | null;
    schoolId?: string | null;
    usage?: Partial<typeof EMPTY_USAGE>;
  } = {},
) {
  const campusExists = jest.fn<Promise<boolean>, [string]>().mockResolvedValue(true);
  const campusSchoolId = jest
    .fn<Promise<string | null>, [string]>()
    .mockResolvedValue(opts.schoolId === undefined ? 's1' : opts.schoolId);
  const clearActiveForSchool = jest.fn().mockResolvedValue(undefined);
  const create = jest
    .fn()
    .mockImplementation((data) => Promise.resolve({ ...YEAR, ...data } as AcademicYear));
  const findById = jest
    .fn<Promise<AcademicYear | null>, [string]>()
    .mockResolvedValue(opts.found === undefined ? YEAR : opts.found);
  const update = jest
    .fn()
    .mockImplementation((_id, data) => Promise.resolve({ ...YEAR, ...data } as AcademicYear));
  const usage = jest.fn().mockResolvedValue({ ...EMPTY_USAGE, ...opts.usage });
  const del = jest.fn().mockResolvedValue(YEAR);
  const repo = {
    campusExists,
    campusSchoolId,
    clearActiveForSchool,
    create,
    findById,
    update,
    usage,
    delete: del,
  } as unknown as AcademicYearRepository;
  return {
    service: new AcademicYearService(repo),
    campusSchoolId,
    clearActiveForSchool,
    create,
    update,
    usage,
    delete: del,
  };
}

describe('AcademicYearService — School-scoped status machine (Decisions 1 & 8)', () => {
  it('derives schoolId from the campus and defaults status to UPCOMING', async () => {
    const { service, create, clearActiveForSchool } = setup();
    const year = await service.create({
      campusId: 'c1',
      name: '2025/2026',
      startDate: '2025-09-01',
      endDate: '2026-06-30',
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 's1' }));
    expect(year.status).toBe(AcademicYearStatus.UPCOMING);
    expect(clearActiveForSchool).not.toHaveBeenCalled();
  });

  it('maps the deprecated isCurrent=true to ACTIVE and supersedes other active years in the school', async () => {
    const { service, create, clearActiveForSchool } = setup();
    const year = await service.create({
      campusId: 'c1',
      name: '2026/2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      isCurrent: true,
    });
    expect(clearActiveForSchool).toHaveBeenCalledWith('s1', 'c1');
    expect(year.status).toBe(AcademicYearStatus.ACTIVE);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ isCurrent: true }));
  });

  it('supersedes the existing active year (excluding self) when a year is activated via update', async () => {
    const { service, clearActiveForSchool, update } = setup();
    await service.update('ay1', { status: AcademicYearStatus.ACTIVE });
    expect(clearActiveForSchool).toHaveBeenCalledWith('s1', 'c1', 'ay1');
    expect(update).toHaveBeenCalledWith(
      'ay1',
      expect.objectContaining({ status: AcademicYearStatus.ACTIVE, isCurrent: true }),
    );
  });

  it('close() flips status to CLOSED and clears the legacy flag', async () => {
    const { service, update } = setup();
    await service.close('ay1');
    expect(update).toHaveBeenCalledWith('ay1', {
      status: AcademicYearStatus.CLOSED,
      isCurrent: false,
    });
  });

  it('close() is idempotent on an already-closed year', async () => {
    const { service, update } = setup({
      found: { ...YEAR, status: AcademicYearStatus.CLOSED },
    });
    const year = await service.close('ay1');
    expect(year.status).toBe(AcademicYearStatus.CLOSED);
    expect(update).not.toHaveBeenCalled();
  });

  it('deletes a completely unused, non-closed year', async () => {
    const { service, delete: del } = setup();
    await service.remove('ay1');
    expect(del).toHaveBeenCalledWith('ay1');
  });

  it('refuses deletion once the year anchors historical data', async () => {
    const { service, delete: del } = setup({ usage: { enrollments: 3 } });
    await expect(service.remove('ay1')).rejects.toThrow(BadRequestException);
    expect(del).not.toHaveBeenCalled();
  });

  it('refuses deletion of a CLOSED year even when otherwise unused', async () => {
    const { service, delete: del } = setup({
      found: { ...YEAR, status: AcademicYearStatus.CLOSED },
    });
    await expect(service.remove('ay1')).rejects.toThrow(BadRequestException);
    expect(del).not.toHaveBeenCalled();
  });
});

// ── Readiness engine — derived entirely from real records (no free-text calendar) ──────────────

const EMPTY_METRICS = {
  studentCount: 0,
  activeEnrollments: 0,
  graduatingStudents: 0,
  withdrawnStudents: 0,
  classCount: 0,
  gradeCount: 0,
  semesterCount: 0,
  outstandingFees: '0',
  unverifiedPayments: 0,
  attendancePct: null,
  reportCardCompletionPct: null,
  timetableCompletionPct: null,
};

/** Two contiguous semesters that exactly tile the YEAR (2025-09-01 … 2026-06-30). */
const FULL_COVER = [
  { startDate: new Date('2025-09-01'), endDate: new Date('2026-01-31') },
  { startDate: new Date('2026-02-01'), endDate: new Date('2026-06-30') },
];

function readinessSetup(opts: {
  year?: Partial<AcademicYear>;
  semesters?: { startDate: Date; endDate: Date }[];
  gradeCount?: number;
  sectionCount?: number;
}) {
  const year: AcademicYear = { ...YEAR, ...opts.year };
  const repo = {
    findById: jest.fn().mockResolvedValue(year),
    setup: jest.fn().mockResolvedValue({
      semesters: opts.semesters ?? FULL_COVER,
      gradeCount: opts.gradeCount ?? 3,
      sectionCount: opts.sectionCount ?? 5,
    }),
    metrics: jest.fn().mockResolvedValue(EMPTY_METRICS),
  } as unknown as AcademicYearRepository;
  return new AcademicYearService(repo);
}

const REG: Partial<AcademicYear> = {
  registrationStartDate: new Date('2025-05-01'),
  registrationEndDate: new Date('2025-08-15'),
};

describe('AcademicYearService — readiness (real-data validation)', () => {
  const checkOk = (r: Awaited<ReturnType<AcademicYearService['readiness']>>, key: string) =>
    r.activation.checks.find((c) => c.key === key)?.ok;

  it('does not reference any academic-calendar setting; a fully-configured year can activate', async () => {
    const service = readinessSetup({ year: REG });
    const r = await service.readiness('ay1');
    expect(r.activation.checks.some((c) => c.key === 'calendar')).toBe(false);
    expect(r.activation.canActivate).toBe(true);
    expect(checkOk(r, 'registration')).toBe(true);
    expect(checkOk(r, 'semestersInsideYear')).toBe(true);
    expect(checkOk(r, 'semestersNoOverlap')).toBe(true);
    expect(checkOk(r, 'semestersCoverYear')).toBe(true);
  });

  it('blocks activation when the registration window is missing', async () => {
    const service = readinessSetup({}); // no registration dates on YEAR
    const r = await service.readiness('ay1');
    expect(checkOk(r, 'registration')).toBe(false);
    expect(r.activation.canActivate).toBe(false);
  });

  it('flags overlapping semesters', async () => {
    const service = readinessSetup({
      year: REG,
      semesters: [
        { startDate: new Date('2025-09-01'), endDate: new Date('2026-02-15') },
        { startDate: new Date('2026-02-01'), endDate: new Date('2026-06-30') },
      ],
    });
    const r = await service.readiness('ay1');
    expect(checkOk(r, 'semestersNoOverlap')).toBe(false);
  });

  it('flags a gap that leaves the year not fully covered', async () => {
    const service = readinessSetup({
      year: REG,
      semesters: [
        { startDate: new Date('2025-09-01'), endDate: new Date('2025-12-31') },
        { startDate: new Date('2026-03-01'), endDate: new Date('2026-06-30') },
      ],
    });
    const r = await service.readiness('ay1');
    expect(checkOk(r, 'semestersCoverYear')).toBe(false);
    // The gap does not itself count as an overlap.
    expect(checkOk(r, 'semestersNoOverlap')).toBe(true);
  });

  it('flags a semester that falls outside the academic year', async () => {
    const service = readinessSetup({
      year: REG,
      semesters: [
        { startDate: new Date('2025-08-01'), endDate: new Date('2026-01-31') },
        { startDate: new Date('2026-02-01'), endDate: new Date('2026-06-30') },
      ],
    });
    const r = await service.readiness('ay1');
    expect(checkOk(r, 'semestersInsideYear')).toBe(false);
  });
});
