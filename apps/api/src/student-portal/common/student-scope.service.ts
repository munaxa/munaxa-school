import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Student } from '@prisma/client';
import { Permission } from '@school/domain';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

/**
 * Row-scopes the student app to the signed-in student's own record (`Student.userId`).
 * A Student principal may only read their own data; staff (no Student profile) act
 * tenant-wide for management endpoints (RLS already scopes them to their tenant).
 */
@Injectable()
export class StudentScopeService extends TenantRepository {
  hasPermission(permission: Permission): boolean {
    return TenantContextStore.get()?.permissions?.includes(permission) ?? false;
  }

  /** The Student profile linked to the acting user, if any. */
  async currentStudent(): Promise<Student | null> {
    const userId = TenantContextStore.get()?.actorUserId;
    if (!userId) return null;
    return this.run((tx) => tx.student.findFirst({ where: { userId, deletedAt: null } }));
  }

  /** The acting student's id, or throw 403 if the caller is not a student. */
  async requireStudentId(): Promise<string> {
    const student = await this.currentStudent();
    if (!student) {
      throw new ForbiddenException('No student profile is linked to your account');
    }
    return student.id;
  }

  /** The acting student (throws 403 if none). */
  async requireStudent(): Promise<Student> {
    const student = await this.currentStudent();
    if (!student) {
      throw new ForbiddenException('No student profile is linked to your account');
    }
    return student;
  }
}
