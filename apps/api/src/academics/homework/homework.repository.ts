import { Injectable } from '@nestjs/common';
import type { Homework, HomeworkAttachment, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class HomeworkRepository extends TenantRepository {
  create(data: Omit<Prisma.HomeworkUncheckedCreateInput, 'tenantId'>): Promise<Homework> {
    return this.run((tx, tenantId) => tx.homework.create({ data: { ...data, tenantId } }));
  }

  findBySection(sectionId: string): Promise<Homework[]> {
    return this.run((tx) =>
      tx.homework.findMany({
        where: { sectionId, deletedAt: null },
        orderBy: { dueDate: 'desc' },
      }),
    );
  }

  findById(id: string): Promise<Homework | null> {
    return this.run((tx) => tx.homework.findFirst({ where: { id, deletedAt: null } }));
  }

  update(id: string, data: Prisma.HomeworkUpdateInput): Promise<Homework> {
    return this.run((tx) => tx.homework.update({ where: { id }, data }));
  }

  softDelete(id: string): Promise<Homework> {
    return this.run((tx) => tx.homework.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  sectionExists(sectionId: string): Promise<boolean> {
    return this.run(
      async (tx) => (await tx.section.findFirst({ where: { id: sectionId } })) !== null,
    );
  }

  addAttachment(
    data: Omit<Prisma.HomeworkAttachmentUncheckedCreateInput, 'tenantId'>,
  ): Promise<HomeworkAttachment> {
    return this.run((tx, tenantId) =>
      tx.homeworkAttachment.create({ data: { ...data, tenantId } }),
    );
  }

  listAttachments(homeworkId: string): Promise<HomeworkAttachment[]> {
    return this.run((tx) =>
      tx.homeworkAttachment.findMany({ where: { homeworkId }, orderBy: { createdAt: 'asc' } }),
    );
  }
}
