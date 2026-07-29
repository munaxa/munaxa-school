import { ForbiddenException, Injectable } from '@nestjs/common';
import { Permission } from '@school/domain';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

/**
 * Row-scopes parent-portal access to a parent's own linked children.
 *
 * A Parent principal may only read/act on students linked to them via `ParentStudent`
 * (Phase 5). Staff who hold a management/approval permission (e.g. leave:approve,
 * ptm:manage) operate tenant-wide (RLS already scopes them to their tenant), so the
 * child restriction does not apply to them.
 */
@Injectable()
export class ParentScopeService extends TenantRepository {
  /** Whether the current principal holds the given permission. */
  hasPermission(permission: Permission): boolean {
    return TenantContextStore.get()?.permissions?.includes(permission) ?? false;
  }

  /** Whether the acting user has a Parent profile (i.e. is acting as a parent). */
  async isParent(): Promise<boolean> {
    return (await this.currentParentId()) !== null;
  }

  /**
   * For routes shared by parents and staff under a single permission (e.g. document:manage):
   * a parent is restricted to their own children; staff (no Parent profile) act tenant-wide.
   */
  async assertManageAccess(studentId: string): Promise<void> {
    if (await this.isParent()) {
      await this.assertChildAccess(studentId);
    }
  }

  /** The Parent profile (id) linked to the acting user, if any (public accessor). */
  async myParentId(): Promise<string | null> {
    return this.currentParentId();
  }

  /** The Parent profile (id) linked to the acting user, if any. */
  private async currentParentId(): Promise<string | null> {
    const userId = TenantContextStore.get()?.actorUserId;
    if (!userId) return null;
    return this.run(async (tx) => {
      const parent = await tx.parent.findFirst({
        where: { userId, deletedAt: null },
        select: { id: true },
      });
      return parent?.id ?? null;
    });
  }

  /** Student ids linked to the acting parent (empty if the user is not a parent). */
  async childIds(): Promise<string[]> {
    const parentId = await this.currentParentId();
    if (!parentId) return [];
    return this.run(async (tx) => {
      const links = await tx.parentStudent.findMany({
        where: { parentId },
        select: { studentId: true },
      });
      return links.map((l) => l.studentId);
    });
  }

  /**
   * Resolve the acting parent's children as lightweight cards (the multi-child switcher).
   */
  async children(): Promise<
    Array<{
      studentId: string;
      relation: string;
      isPrimary: boolean;
      firstNameEn: string;
      lastNameEn: string;
      firstNameAr: string;
      lastNameAr: string;
      sectionId: string | null;
      status: string;
    }>
  > {
    const parentId = await this.currentParentId();
    if (!parentId) return [];
    return this.run(async (tx) => {
      const links = await tx.parentStudent.findMany({
        where: { parentId },
        include: { student: true },
        orderBy: { isPrimary: 'desc' },
      });
      return links
        .filter((link) => link.student.deletedAt === null)
        .map((link) => ({
          studentId: link.studentId,
          relation: link.relation,
          isPrimary: link.isPrimary,
          firstNameEn: link.student.firstNameEn,
          lastNameEn: link.student.lastNameEn,
          firstNameAr: link.student.firstNameAr,
          lastNameAr: link.student.lastNameAr,
          sectionId: link.student.sectionId,
          status: link.student.status,
        }));
    });
  }

  /**
   * Assert the acting parent may access `studentId`. Throws 403 otherwise.
   * (Use on every parent-facing write/read keyed by a student.)
   */
  async assertChildAccess(studentId: string): Promise<void> {
    const ids = await this.childIds();
    if (!ids.includes(studentId)) {
      throw new ForbiddenException('This student is not linked to your account');
    }
  }
}
