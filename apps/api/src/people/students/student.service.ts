import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import type { ParentStudent, Prisma, Student, StudentVaccine } from '@prisma/client';
import { LimitKey } from '@school/domain';
import { StudentRepository, type ParentLink } from './student.repository';
import { AccountRepository } from '../../finance/account/account.repository';
import { SubscriptionService } from '../../subscription/subscription.service';
import { DomainEvents } from '../../events/domain-events';
import { requireTenantId } from '../../common/tenant.util';
import { generateStudentQrCode } from '../people.util';
import type {
  CreateStudentDto,
  CreateVaccineDto,
  LinkParentDto,
  UpdateStudentDto,
  UpdateVaccineDto,
} from './student.dto';

export interface ImportResult {
  created: number;
  failed: Array<{ row: number; error: string }>;
}

/**
 * Normalise a blank/whitespace-only identifier to null. The partial unique indexes on
 * (tenantId, nationalId) and (tenantId, moeStudentNumber) exempt NULL but NOT the empty string,
 * so an empty '' from a cleared form field would collide across students. Store blanks as NULL.
 */
function blankToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

@Injectable()
export class StudentService {
  constructor(
    private readonly repo: StudentRepository,
    private readonly accounts: AccountRepository,
    private readonly subscriptions: SubscriptionService,
    private readonly events: DomainEvents,
  ) {}

  async create(dto: CreateStudentDto): Promise<Student> {
    // A Student is a permanent identity record; placement is set when the student is enrolled.
    // Enforce the plan's student limit centrally (core Students module is never hidden — we only
    // block crossing the quota, with an upgrade message). The live count is authoritative.
    const tenantId = requireTenantId();
    const count = await this.repo.countActive();
    await this.subscriptions.assertCapacity(tenantId, LimitKey.STUDENTS, count, 1);
    const student = await this.repo.create(this.toCreateInput(dto));
    // Publish a fact; the UsageService consumer updates the usage counter (event-driven, decoupled
    // from subscription logic). The new count is authoritative so the counter never drifts.
    this.events.emit({ type: 'StudentCreated', tenantId, total: count + 1 });
    return student;
  }

  list(filter: {
    sectionId?: string;
    status?: Student['status'];
    search?: string;
  }): Promise<Student[]> {
    return this.repo.findMany(filter);
  }

  async get(id: string): Promise<Student> {
    const student = await this.repo.findById(id);
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async update(id: string, dto: UpdateStudentDto): Promise<Student> {
    await this.get(id);
    // Identity only. Grade/section/classroom/area/transport are year-scoped placement — they live on
    // the Enrollment and are changed via the enrollment endpoints, never on the Student (Decisions 4 & 13).
    const data: Prisma.StudentUpdateInput = {
      ...(dto.firstNameEn !== undefined ? { firstNameEn: dto.firstNameEn } : {}),
      ...(dto.lastNameEn !== undefined ? { lastNameEn: dto.lastNameEn } : {}),
      ...(dto.firstNameAr !== undefined ? { firstNameAr: dto.firstNameAr } : {}),
      ...(dto.lastNameAr !== undefined ? { lastNameAr: dto.lastNameAr } : {}),
      ...(dto.fatherNameEn !== undefined ? { fatherNameEn: dto.fatherNameEn } : {}),
      ...(dto.fatherNameAr !== undefined ? { fatherNameAr: dto.fatherNameAr } : {}),
      ...(dto.thirdNameEn !== undefined ? { thirdNameEn: dto.thirdNameEn } : {}),
      ...(dto.thirdNameAr !== undefined ? { thirdNameAr: dto.thirdNameAr } : {}),
      ...(dto.moeStudentNumber !== undefined
        ? { moeStudentNumber: blankToNull(dto.moeStudentNumber) }
        : {}),
      ...(dto.nationalId !== undefined ? { nationalId: blankToNull(dto.nationalId) } : {}),
      ...(dto.dateOfBirth ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };
    return this.repo.update(id, data);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    // Deletion is only for a draft student with NO dependent records; otherwise Withdraw / Cancel
    // Admission (never destroy history). See deletability().
    const blockers = await this.repo.deletionBlockers(id);
    if (blockers.length > 0) {
      throw new BadRequestException(
        `Student cannot be deleted (has ${blockers.join(', ')}). Withdraw or cancel the admission instead.`,
      );
    }
    await this.repo.softDelete(id);
  }

  /** Whether the student may be hard-deleted, and if not, why (drives showing Delete vs Withdraw). */
  async deletability(id: string): Promise<{ deletable: boolean; blockers: string[] }> {
    await this.get(id);
    const blockers = await this.repo.deletionBlockers(id);
    return { deletable: blockers.length === 0, blockers };
  }

  /** Immutable per-year Enrollment History for the profile (Decisions 12 & 13). */
  async enrollmentHistory(id: string) {
    await this.get(id);
    return this.repo.enrollmentHistory(id);
  }

  async qr(id: string): Promise<{ qrCode: string }> {
    const student = await this.get(id);
    return { qrCode: student.qrCode };
  }

  // ----- Parent linking ----------------------------------------------------
  async linkParent(studentId: string, dto: LinkParentDto): Promise<ParentStudent> {
    await this.get(studentId);
    if (!(await this.repo.parentExists(dto.parentId))) {
      throw new BadRequestException('Parent not found in this tenant');
    }
    const link = await this.repo.linkParent(
      studentId,
      dto.parentId,
      dto.relation,
      dto.isPrimary ?? false,
    );
    // Assigning the paying guardian places the student under that guardian's Financial Account so
    // they surface in Finance and family payments allocate across siblings. Non-destructive: a
    // student already billed to another account is left untouched.
    await this.accounts.reconcileStudentAccount(studentId);
    return link;
  }

  async unlinkParent(studentId: string, parentId: string): Promise<void> {
    await this.get(studentId);
    await this.repo.unlinkParent(studentId, parentId);
  }

  async listParents(studentId: string): Promise<ParentLink[]> {
    await this.get(studentId);
    return this.repo.listParents(studentId);
  }

  // ----- Vaccines ----------------------------------------------------------
  async listVaccines(studentId: string): Promise<StudentVaccine[]> {
    await this.get(studentId);
    return this.repo.listVaccines(studentId);
  }

  async addVaccine(studentId: string, dto: CreateVaccineDto): Promise<StudentVaccine> {
    await this.get(studentId);
    return this.repo.createVaccine({
      studentId,
      name: dto.name,
      grade: dto.grade ?? null,
      received: dto.received ?? true,
      dateGiven: dto.dateGiven ? new Date(dto.dateGiven) : null,
      notes: dto.notes ?? null,
    });
  }

  async updateVaccine(
    studentId: string,
    vaccineId: string,
    dto: UpdateVaccineDto,
  ): Promise<StudentVaccine> {
    await this.getVaccine(studentId, vaccineId);
    const data: Prisma.StudentVaccineUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.grade !== undefined ? { grade: dto.grade } : {}),
      ...(dto.received !== undefined ? { received: dto.received } : {}),
      ...(dto.dateGiven !== undefined
        ? { dateGiven: dto.dateGiven ? new Date(dto.dateGiven) : null }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    };
    return this.repo.updateVaccine(vaccineId, data);
  }

  async removeVaccine(studentId: string, vaccineId: string): Promise<void> {
    await this.getVaccine(studentId, vaccineId);
    await this.repo.deleteVaccine(vaccineId);
  }

  private async getVaccine(studentId: string, vaccineId: string): Promise<StudentVaccine> {
    await this.get(studentId);
    const vaccine = await this.repo.findVaccine(studentId, vaccineId);
    if (!vaccine) throw new NotFoundException('Vaccine record not found');
    return vaccine;
  }

  // ----- Bulk CSV import ---------------------------------------------------
  async importCsv(csv: string): Promise<ImportResult> {
    let records: Record<string, string>[];
    try {
      records = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<
        string,
        string
      >[];
    } catch {
      throw new BadRequestException('Could not parse CSV');
    }
    if (records.length === 0) throw new BadRequestException('CSV contains no data rows');

    const failed: ImportResult['failed'] = [];
    const valid: Array<Omit<Prisma.StudentUncheckedCreateInput, 'tenantId'>> = [];

    records.forEach((record, index) => {
      const required = ['firstNameEn', 'lastNameEn', 'firstNameAr', 'lastNameAr'] as const;
      const missing = required.filter((key) => !record[key]);
      if (missing.length > 0) {
        failed.push({ row: index + 2, error: `Missing: ${missing.join(', ')}` });
        return;
      }
      valid.push(
        this.toCreateInput({
          firstNameEn: record.firstNameEn!,
          lastNameEn: record.lastNameEn!,
          firstNameAr: record.firstNameAr!,
          lastNameAr: record.lastNameAr!,
          fatherNameEn: record.fatherNameEn || undefined,
          fatherNameAr: record.fatherNameAr || undefined,
          thirdNameEn: record.thirdNameEn || undefined,
          thirdNameAr: record.thirdNameAr || undefined,
          moeStudentNumber: record.moeStudentNumber || undefined,
          nationalId: record.nationalId || undefined,
        }),
      );
    });

    let created = 0;
    if (valid.length > 0) {
      const inserted = await this.repo.createManyTx(valid);
      created = inserted.length;
    }
    return { created, failed };
  }

  // ----- Internals ---------------------------------------------------------
  private toCreateInput(
    dto: CreateStudentDto,
  ): Omit<Prisma.StudentUncheckedCreateInput, 'tenantId'> {
    return {
      firstNameEn: dto.firstNameEn,
      lastNameEn: dto.lastNameEn,
      firstNameAr: dto.firstNameAr,
      lastNameAr: dto.lastNameAr,
      fatherNameEn: dto.fatherNameEn ?? null,
      fatherNameAr: dto.fatherNameAr ?? null,
      thirdNameEn: dto.thirdNameEn ?? null,
      thirdNameAr: dto.thirdNameAr ?? null,
      moeStudentNumber: blankToNull(dto.moeStudentNumber),
      nationalId: blankToNull(dto.nationalId),
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      gender: dto.gender ?? null,
      status: dto.status ?? 'ACTIVE',
      qrCode: generateStudentQrCode(),
    };
  }
}
