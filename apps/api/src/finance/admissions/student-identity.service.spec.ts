import { BadRequestException } from '@nestjs/common';
import { EnrollmentStatus } from '@prisma/client';
import { StudentIdentityService } from './student-identity.service';
import type { StudentIdentityRepository, IdentityStudent } from './student-identity.repository';

const STUDENT = {
  id: 'stu1',
  studentNumber: '000123',
  firstNameEn: 'Omar',
  lastNameEn: 'Haddad',
  firstNameAr: 'عمر',
  lastNameAr: 'حداد',
  nationalId: '9990001',
  moeStudentNumber: 'MOE-1',
  financialAccount: { payerId: 'payer-9' },
} as IdentityStudent;

function setup(opts: {
  found?: IdentityStudent | null;
  current?: {
    id: string;
    status: EnrollmentStatus;
    grade: { nameEn: string };
    academicYear: { name: string };
  } | null;
}) {
  const findByIdentifier = jest.fn().mockResolvedValue(opts.found ?? null);
  const currentEnrollment = jest.fn().mockResolvedValue(opts.current ?? null);
  const similarByName = jest.fn().mockResolvedValue([]);
  const repo = {
    findByIdentifier,
    currentEnrollment,
    similarByName,
  } as unknown as StudentIdentityRepository;
  return { service: new StudentIdentityService(repo), findByIdentifier, currentEnrollment };
}

const enrollment = (status: EnrollmentStatus) => ({
  id: 'enr1',
  status,
  grade: { nameEn: 'Grade 4' },
  academicYear: { name: '2026/2027' },
});

describe('StudentIdentityService.lookupByIdentifier (Cases A/B/C)', () => {
  it('requires at least one identifier', async () => {
    const { service } = setup({});
    await expect(service.lookupByIdentifier({})).rejects.toThrow(BadRequestException);
  });

  it('Case A — NEW when no student matches the identifier', async () => {
    const { service } = setup({ found: null });
    const r = await service.lookupByIdentifier({ nationalId: '123' });
    expect(r.case).toBe('NEW');
    expect(r.student).toBeNull();
  });

  it('Case B — ACTIVE when the student has an active current-year enrollment', async () => {
    const { service } = setup({ found: STUDENT, current: enrollment(EnrollmentStatus.ACTIVE) });
    const r = await service.lookupByIdentifier({ nationalId: '9990001' });
    expect(r.case).toBe('ACTIVE');
    expect(r.student?.financialAccountId).toBe('payer-9');
    expect(r.currentEnrollment?.academicYearName).toBe('2026/2027');
  });

  it('Case C — RETURNING when the student exists but has no active enrollment', async () => {
    const { service } = setup({ found: STUDENT, current: null });
    const r = await service.lookupByIdentifier({ nationalId: '9990001' });
    expect(r.case).toBe('RETURNING');
    expect(r.student?.id).toBe('stu1');
  });

  it('Case C — RETURNING when the current-year enrollment is withdrawn (not actively participating)', async () => {
    const { service } = setup({ found: STUDENT, current: enrollment(EnrollmentStatus.WITHDRAWN) });
    const r = await service.lookupByIdentifier({ nationalId: '9990001' });
    expect(r.case).toBe('RETURNING');
  });
});

describe('StudentIdentityService.similarNames (informational only)', () => {
  it('returns [] for a too-short query without hitting the repo', async () => {
    const { service } = setup({});
    expect(await service.similarNames('a')).toEqual([]);
  });
});
