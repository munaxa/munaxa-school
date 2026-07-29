import { Injectable } from '@nestjs/common';
import type { Prisma, Section } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

/** A section enriched with its parent grade, so callers can label it unambiguously. */
export type SectionWithGrade = Prisma.SectionGetPayload<{
  include: { grade: { select: { id: true; nameEn: true; nameAr: true; level: true } } };
}>;

@Injectable()
export class SectionRepository extends TenantRepository {
  create(data: Omit<Prisma.SectionUncheckedCreateInput, 'tenantId'>): Promise<Section> {
    return this.run((tx, tenantId) => tx.section.create({ data: { ...data, tenantId } }));
  }

  findMany(gradeId?: string): Promise<SectionWithGrade[]> {
    return this.run((tx) =>
      tx.section.findMany({
        where: { ...(gradeId ? { gradeId } : {}) },
        include: { grade: { select: { id: true, nameEn: true, nameAr: true, level: true } } },
        // Order by grade level first, then section name, so the list reads top-down by grade.
        orderBy: [{ grade: { level: 'asc' } }, { name: 'asc' }],
      }),
    );
  }

  findById(id: string): Promise<Section | null> {
    return this.run((tx) => tx.section.findFirst({ where: { id } }));
  }

  update(id: string, data: Prisma.SectionUpdateInput): Promise<Section> {
    return this.run((tx) => tx.section.update({ where: { id }, data }));
  }

  delete(id: string): Promise<Section> {
    return this.run((tx) => tx.section.delete({ where: { id } }));
  }

  gradeExists(gradeId: string): Promise<boolean> {
    return this.run(async (tx) => (await tx.grade.findFirst({ where: { id: gradeId } })) !== null);
  }

  classroomExists(classroomId: string): Promise<boolean> {
    return this.run(
      async (tx) => (await tx.classroom.findFirst({ where: { id: classroomId } })) !== null,
    );
  }
}
