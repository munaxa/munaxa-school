import { Injectable } from '@nestjs/common';
import type { Prisma, Resource } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class ResourceRepository extends TenantRepository {
  create(data: Omit<Prisma.ResourceUncheckedCreateInput, 'tenantId'>): Promise<Resource> {
    return this.run((tx, tenantId) => tx.resource.create({ data: { ...data, tenantId } }));
  }

  findById(id: string): Promise<Resource | null> {
    return this.run((tx) => tx.resource.findFirst({ where: { id, deletedAt: null } }));
  }

  /** Staff view: all resources in the tenant. */
  findMany(): Promise<Resource[]> {
    return this.run((tx) =>
      tx.resource.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    );
  }

  /**
   * Student view: resources visible to a student — scoped to their section, their grade, or the
   * whole school (both scopes null).
   */
  findForStudent(sectionId: string | null, gradeId: string | null): Promise<Resource[]> {
    return this.run((tx) =>
      tx.resource.findMany({
        where: {
          deletedAt: null,
          OR: [
            ...(sectionId ? [{ sectionId }] : []),
            ...(gradeId ? [{ gradeId }] : []),
            { AND: [{ sectionId: null }, { gradeId: null }] },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    );
  }

  update(id: string, data: Prisma.ResourceUpdateInput): Promise<Resource> {
    return this.run((tx) => tx.resource.update({ where: { id }, data }));
  }

  softDelete(id: string): Promise<Resource> {
    return this.run((tx) => tx.resource.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  /** Resolve a section's gradeId (to widen a student's resource visibility to their grade). */
  sectionGradeId(sectionId: string): Promise<string | null> {
    return this.run(async (tx) => {
      const section = await tx.section.findFirst({
        where: { id: sectionId },
        select: { gradeId: true },
      });
      return section?.gradeId ?? null;
    });
  }

  sectionExists(sectionId: string): Promise<boolean> {
    return this.run(
      async (tx) => (await tx.section.findFirst({ where: { id: sectionId } })) !== null,
    );
  }
}
