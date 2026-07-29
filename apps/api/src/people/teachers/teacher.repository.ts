import { Injectable } from '@nestjs/common';
import type { Prisma, Teacher, TeacherSection } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class TeacherRepository extends TenantRepository {
  create(data: Omit<Prisma.TeacherUncheckedCreateInput, 'tenantId'>): Promise<Teacher> {
    return this.run((tx, tenantId) => tx.teacher.create({ data: { ...data, tenantId } }));
  }

  findMany(): Promise<Teacher[]> {
    return this.run((tx) =>
      tx.teacher.findMany({ where: { deletedAt: null }, orderBy: { lastNameEn: 'asc' } }),
    );
  }

  findById(id: string): Promise<Teacher | null> {
    return this.run((tx) => tx.teacher.findFirst({ where: { id, deletedAt: null } }));
  }

  update(id: string, data: Prisma.TeacherUpdateInput): Promise<Teacher> {
    return this.run((tx) => tx.teacher.update({ where: { id }, data }));
  }

  softDelete(id: string): Promise<Teacher> {
    return this.run((tx) => tx.teacher.update({ where: { id }, data: { deletedAt: new Date() } }));
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
