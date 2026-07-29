import { Injectable } from '@nestjs/common';
import { type Prisma, type TrainingCourse } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

const RECORD_INCLUDE = {
  course: { select: { id: true, title: true, mandatory: true } },
  employee: { select: { id: true, firstNameEn: true, lastNameEn: true } },
} satisfies Prisma.TrainingRecordInclude;

export type TrainingRecordView = Prisma.TrainingRecordGetPayload<{
  include: typeof RECORD_INCLUDE;
}>;

@Injectable()
export class TrainingRepository extends TenantRepository {
  // ----- Courses -------------------------------------------------------------
  createCourse(
    data: Omit<Prisma.TrainingCourseUncheckedCreateInput, 'tenantId'>,
  ): Promise<TrainingCourse> {
    return this.run(async (tx, tenantId) => {
      const course = await tx.trainingCourse.create({ data: { ...data, tenantId } });
      await this.writeAudit(tx, tenantId, {
        action: 'training_course.create',
        entityType: 'TrainingCourse',
        entityId: course.id,
      });
      return course;
    });
  }
  listCourses(): Promise<TrainingCourse[]> {
    return this.run((tx) =>
      tx.trainingCourse.findMany({ where: { deletedAt: null }, orderBy: { title: 'asc' } }),
    );
  }
  findCourse(id: string): Promise<TrainingCourse | null> {
    return this.run((tx) => tx.trainingCourse.findFirst({ where: { id, deletedAt: null } }));
  }
  updateCourse(
    id: string,
    data: Prisma.TrainingCourseUncheckedUpdateInput,
  ): Promise<TrainingCourse> {
    return this.run(async (tx, tenantId) => {
      const course = await tx.trainingCourse.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'training_course.update',
        entityType: 'TrainingCourse',
        entityId: id,
      });
      return course;
    });
  }
  softDeleteCourse(id: string): Promise<TrainingCourse> {
    return this.run(async (tx, tenantId) => {
      const course = await tx.trainingCourse.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'training_course.delete',
        entityType: 'TrainingCourse',
        entityId: id,
      });
      return course;
    });
  }

  // ----- Records -------------------------------------------------------------
  employeeExists(employeeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.employee.findFirst({ where: { id: employeeId, deletedAt: null } })) !== null,
    );
  }
  enroll(employeeId: string, courseId: string): Promise<TrainingRecordView> {
    return this.run(async (tx, tenantId) => {
      const record = await tx.trainingRecord.create({
        data: { tenantId, employeeId, courseId },
        include: RECORD_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'training_record.enroll',
        entityType: 'TrainingRecord',
        entityId: record.id,
        metadata: { employeeId, courseId },
      });
      return record;
    });
  }
  listForEmployee(employeeId: string): Promise<TrainingRecordView[]> {
    return this.run((tx) =>
      tx.trainingRecord.findMany({
        where: { employeeId },
        include: RECORD_INCLUDE,
        orderBy: { enrolledAt: 'desc' },
      }),
    );
  }
  findRecord(id: string): Promise<TrainingRecordView | null> {
    return this.run((tx) =>
      tx.trainingRecord.findFirst({ where: { id }, include: RECORD_INCLUDE }),
    );
  }
  updateRecord(
    id: string,
    data: Prisma.TrainingRecordUncheckedUpdateInput,
  ): Promise<TrainingRecordView> {
    return this.run(async (tx, tenantId) => {
      const record = await tx.trainingRecord.update({
        where: { id },
        data,
        include: RECORD_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'training_record.update',
        entityType: 'TrainingRecord',
        entityId: id,
      });
      return record;
    });
  }
  deleteRecord(id: string): Promise<void> {
    return this.run(async (tx, tenantId) => {
      await tx.trainingRecord.delete({ where: { id } });
      await this.writeAudit(tx, tenantId, {
        action: 'training_record.delete',
        entityType: 'TrainingRecord',
        entityId: id,
      });
    });
  }

  /** Records whose certification expires on or before `cutoff` (and not yet expired-in-past-only). */
  expiringBefore(cutoff: Date): Promise<TrainingRecordView[]> {
    return this.run((tx) =>
      tx.trainingRecord.findMany({
        where: { expiresAt: { not: null, lte: cutoff } },
        include: RECORD_INCLUDE,
        orderBy: { expiresAt: 'asc' },
      }),
    );
  }
}
