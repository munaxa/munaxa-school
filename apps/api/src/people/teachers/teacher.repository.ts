import { Injectable } from '@nestjs/common';
import type { Prisma, TeacherSection } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

/**
 * The teaching facet always travels with what it teaches: a teacher is only ever read to be put
 * in front of a class, and the subject list is what says which class that may be.
 */
const TEACHER_INCLUDE = {
  subjects: {
    include: { subject: { select: { id: true, nameEn: true, nameAr: true, colorHex: true } } },
    orderBy: { subject: { nameEn: 'asc' as const } },
  },
} satisfies Prisma.TeacherInclude;

export type TeacherWithSubjects = Prisma.TeacherGetPayload<{ include: typeof TEACHER_INCLUDE }>;

@Injectable()
export class TeacherRepository extends TenantRepository {
  findMany(): Promise<TeacherWithSubjects[]> {
    return this.run((tx) =>
      tx.teacher.findMany({
        where: { deletedAt: null },
        include: TEACHER_INCLUDE,
        orderBy: { lastNameEn: 'asc' },
      }),
    );
  }

  findById(id: string): Promise<TeacherWithSubjects | null> {
    return this.run((tx) =>
      tx.teacher.findFirst({ where: { id, deletedAt: null }, include: TEACHER_INCLUDE }),
    );
  }

  update(id: string, data: Prisma.TeacherUpdateInput): Promise<TeacherWithSubjects> {
    return this.run((tx) => tx.teacher.update({ where: { id }, data, include: TEACHER_INCLUDE }));
  }

  softDelete(id: string): Promise<unknown> {
    return this.run((tx) => tx.teacher.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  /** Ids of the given subjects that actually exist, live, in this tenant. */
  liveSubjectIds(subjectIds: string[]): Promise<string[]> {
    return this.run(async (tx) => {
      const rows = await tx.subject.findMany({
        where: { id: { in: subjectIds }, deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    });
  }

  /** Replace a teacher's subjects with exactly `subjectIds`. */
  setSubjects(teacherId: string, subjectIds: string[]): Promise<unknown> {
    return this.run(async (tx, tenantId) => {
      await tx.teacherSubject.deleteMany({
        where: { teacherId, subjectId: { notIn: subjectIds } },
      });
      if (subjectIds.length === 0) return;
      await tx.teacherSubject.createMany({
        data: subjectIds.map((subjectId) => ({ tenantId, teacherId, subjectId })),
        skipDuplicates: true,
      });
    });
  }

  sectionExists(sectionId: string): Promise<boolean> {
    return this.run(
      async (tx) => (await tx.section.findFirst({ where: { id: sectionId } })) !== null,
    );
  }

  assignmentExists(teacherId: string, sectionId: string, subject: string | null): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.teacherSection.findFirst({ where: { teacherId, sectionId, subject } })) !== null,
    );
  }

  assignSection(
    teacherId: string,
    sectionId: string,
    subject: string | null,
  ): Promise<TeacherSection> {
    return this.run((tx, tenantId) =>
      tx.teacherSection.create({ data: { tenantId, teacherId, sectionId, subject } }),
    );
  }

  unassign(assignmentId: string): Promise<unknown> {
    return this.run((tx) => tx.teacherSection.deleteMany({ where: { id: assignmentId } }));
  }

  listSections(teacherId: string): Promise<TeacherSection[]> {
    return this.run((tx) => tx.teacherSection.findMany({ where: { teacherId } }));
  }
}
