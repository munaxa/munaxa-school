import { Injectable } from '@nestjs/common';
import type { ParentStudent, Prisma, Student, StudentStatus, StudentVaccine } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { allocateStudentNumber } from './student-number';

/** A parent↔student link enriched with the parent's contact details. */
export type ParentLink = Prisma.ParentStudentGetPayload<{ include: { parent: true } }>;

@Injectable()
export class StudentRepository extends TenantRepository {
  create(data: Omit<Prisma.StudentUncheckedCreateInput, 'tenantId'>): Promise<Student> {
    return this.run(async (tx, tenantId) => {
      // Every student gets a permanent internal Student Number (Decision 6), unless one is supplied.
      const studentNumber = data.studentNumber ?? (await allocateStudentNumber(tx, tenantId));
      return tx.student.create({ data: { ...data, tenantId, studentNumber } });
    });
  }

  /** Count non-deleted students in the tenant — the live figure for subscription quota checks. */
  countActive(): Promise<number> {
    return this.run((tx) => tx.student.count({ where: { deletedAt: null } }));
  }

  /** Create many students in one transaction; returns the created rows. */
  createManyTx(
    rows: Array<Omit<Prisma.StudentUncheckedCreateInput, 'tenantId'>>,
  ): Promise<Student[]> {
    return this.run((tx, tenantId) =>
      Promise.all(
        rows.map(async (data) => {
          const studentNumber = data.studentNumber ?? (await allocateStudentNumber(tx, tenantId));
          return tx.student.create({ data: { ...data, tenantId, studentNumber } });
        }),
      ),
    );
  }

  findMany(filter: {
    sectionId?: string;
    status?: StudentStatus;
    search?: string;
  }): Promise<Student[]> {
    const q = filter.search?.trim();
    const contains = q ? ({ contains: q, mode: 'insensitive' } as Prisma.StringFilter) : undefined;
    return this.run((tx) =>
      tx.student.findMany({
        where: {
          deletedAt: null,
          ...(filter.sectionId ? { sectionId: filter.sectionId } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          // Search across every name part (given · father · grandfather · family, EN + AR)
          // plus the national / MoE numbers.
          ...(contains
            ? {
                OR: [
                  { firstNameEn: contains },
                  { firstNameAr: contains },
                  { fatherNameEn: contains },
                  { fatherNameAr: contains },
                  { thirdNameEn: contains },
                  { thirdNameAr: contains },
                  { lastNameEn: contains },
                  { lastNameAr: contains },
                  { nationalId: contains },
                  { moeStudentNumber: contains },
                  { studentNumber: contains },
                ],
              }
            : {}),
        },
        orderBy: { lastNameEn: 'asc' },
        take: q ? 50 : undefined,
      }),
    );
  }

  findById(id: string): Promise<Student | null> {
    return this.run((tx) => tx.student.findFirst({ where: { id, deletedAt: null } }));
  }

  update(id: string, data: Prisma.StudentUpdateInput): Promise<Student> {
    return this.run((tx) => tx.student.update({ where: { id }, data }));
  }

  softDelete(id: string): Promise<Student> {
    return this.run((tx) => tx.student.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  /**
   * Records that block hard deletion (spec: delete only a draft student with NO dependent records;
   * otherwise Withdraw or Cancel Admission). Any non-cancelled/non-draft enrollment, or any academic /
   * finance / document / transport / clinic / card record, blocks. Returns the list of blocker kinds.
   */
  deletionBlockers(id: string): Promise<string[]> {
    return this.run(async (tx) => {
      const [
        enrollments,
        attendance,
        grades,
        behavior,
        charges,
        payments,
        documents,
        transport,
        clinic,
        cards,
      ] = await Promise.all([
        tx.enrollment.count({
          where: { studentId: id, admissionStatus: { notIn: ['CANCELLED', 'DRAFT'] } },
        }),
        tx.studentAttendance.count({ where: { studentId: id } }),
        tx.gradeRecord.count({ where: { studentId: id } }),
        tx.behaviorLog.count({ where: { studentId: id } }),
        tx.charge.count({ where: { studentId: id } }),
        tx.payment.count({ where: { studentId: id } }),
        tx.document.count({ where: { studentId: id } }),
        tx.studentBusAssignment.count({ where: { studentId: id } }),
        tx.clinicVisit.count({ where: { studentId: id } }),
        tx.studentCard.count({ where: { studentId: id } }),
      ]);
      const blockers: string[] = [];
      if (enrollments > 0) blockers.push('enrollments');
      if (attendance > 0) blockers.push('attendance');
      if (grades > 0) blockers.push('grades');
      if (behavior > 0) blockers.push('behavior');
      if (charges > 0) blockers.push('finance');
      if (payments > 0) blockers.push('payments');
      if (documents > 0) blockers.push('documents');
      if (transport > 0) blockers.push('transport');
      if (clinic > 0) blockers.push('clinic');
      if (cards > 0) blockers.push('cards');
      return blockers;
    });
  }

  /** Immutable per-year Enrollment History (Decisions 12 & 13), newest year first. */
  enrollmentHistory(id: string) {
    return this.run((tx) =>
      tx.enrollment.findMany({
        where: { studentId: id },
        select: {
          id: true,
          admissionStatus: true,
          status: true,
          admissionDate: true,
          withdrawalDate: true,
          graduationDate: true,
          reason: true,
          grade: { select: { id: true, nameEn: true, nameAr: true } },
          section: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true, startDate: true, status: true } },
        },
        orderBy: { academicYear: { startDate: 'desc' } },
      }),
    );
  }

  sectionExists(sectionId: string): Promise<boolean> {
    return this.run(
      async (tx) => (await tx.section.findFirst({ where: { id: sectionId } })) !== null,
    );
  }

  // RLS scopes this to the active tenant, so a cross-tenant area id is simply not found.
  areaExists(areaId: string): Promise<boolean> {
    return this.run(
      async (tx) => (await tx.area.findFirst({ where: { id: areaId, deletedAt: null } })) !== null,
    );
  }

  parentExists(parentId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.parent.findFirst({ where: { id: parentId, deletedAt: null } })) !== null,
    );
  }

  linkParent(
    studentId: string,
    parentId: string,
    relation: Prisma.ParentStudentUncheckedCreateInput['relation'],
    isPrimary: boolean,
  ): Promise<ParentStudent> {
    return this.run((tx, tenantId) =>
      tx.parentStudent.upsert({
        where: { parentId_studentId: { parentId, studentId } },
        update: { relation, isPrimary },
        create: { tenantId, studentId, parentId, relation, isPrimary },
      }),
    );
  }

  unlinkParent(studentId: string, parentId: string): Promise<unknown> {
    return this.run((tx) => tx.parentStudent.deleteMany({ where: { studentId, parentId } }));
  }

  listParents(studentId: string): Promise<ParentLink[]> {
    return this.run((tx) =>
      tx.parentStudent.findMany({
        where: { studentId },
        include: { parent: true },
        orderBy: { isPrimary: 'desc' },
      }),
    );
  }

  // ----- Vaccines ----------------------------------------------------------
  listVaccines(studentId: string): Promise<StudentVaccine[]> {
    return this.run((tx) =>
      tx.studentVaccine.findMany({ where: { studentId }, orderBy: { createdAt: 'asc' } }),
    );
  }

  createVaccine(
    data: Omit<Prisma.StudentVaccineUncheckedCreateInput, 'tenantId'>,
  ): Promise<StudentVaccine> {
    return this.run((tx, tenantId) => tx.studentVaccine.create({ data: { ...data, tenantId } }));
  }

  findVaccine(studentId: string, vaccineId: string): Promise<StudentVaccine | null> {
    return this.run((tx) => tx.studentVaccine.findFirst({ where: { id: vaccineId, studentId } }));
  }

  updateVaccine(
    vaccineId: string,
    data: Prisma.StudentVaccineUpdateInput,
  ): Promise<StudentVaccine> {
    return this.run((tx) => tx.studentVaccine.update({ where: { id: vaccineId }, data }));
  }

  deleteVaccine(vaccineId: string): Promise<unknown> {
    return this.run((tx) => tx.studentVaccine.delete({ where: { id: vaccineId } }));
  }
}
