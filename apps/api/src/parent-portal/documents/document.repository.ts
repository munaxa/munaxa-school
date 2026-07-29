import { Injectable } from '@nestjs/common';
import type { Document, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class DocumentRepository extends TenantRepository {
  create(data: Omit<Prisma.DocumentUncheckedCreateInput, 'tenantId'>): Promise<Document> {
    return this.run((tx, tenantId) => tx.document.create({ data: { ...data, tenantId } }));
  }

  findById(id: string): Promise<Document | null> {
    return this.run((tx) => tx.document.findFirst({ where: { id, deletedAt: null } }));
  }

  findForStudents(studentIds: string[]): Promise<Document[]> {
    return this.run((tx) =>
      tx.document.findMany({
        where: { studentId: { in: studentIds }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  findByStudent(studentId: string): Promise<Document[]> {
    return this.run((tx) =>
      tx.document.findMany({
        where: { studentId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  softDelete(id: string): Promise<Document> {
    return this.run((tx) => tx.document.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  studentExists(studentId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.student.findFirst({ where: { id: studentId, deletedAt: null } })) !== null,
    );
  }
}
