import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

/** Minimal student identity + billing summary for the admission identity lookup (Step 6). */
const IDENTITY_SELECT = {
  id: true,
  studentNumber: true,
  firstNameEn: true,
  lastNameEn: true,
  firstNameAr: true,
  lastNameAr: true,
  nationalId: true,
  moeStudentNumber: true,
  financialAccount: { select: { payerId: true } },
} satisfies Prisma.StudentSelect;

export type IdentityStudent = Prisma.StudentGetPayload<{ select: typeof IDENTITY_SELECT }>;

@Injectable()
export class StudentIdentityRepository extends TenantRepository {
  /**
   * Exact-match identity lookup (Decision: National ID primary, MoE number fallback). NEVER fuzzy —
   * name/DOB are not compared. Soft-deleted students do not resolve (their identifier is free to reuse).
   */
  async findByIdentifier(
    nationalId?: string,
    moeStudentNumber?: string,
  ): Promise<IdentityStudent | null> {
    return this.run(async (tx) => {
      if (nationalId) {
        const byNid = await tx.student.findFirst({
          where: { nationalId, deletedAt: null },
          select: IDENTITY_SELECT,
        });
        if (byNid) return byNid;
      }
      if (moeStudentNumber) {
        return tx.student.findFirst({
          where: { moeStudentNumber, deletedAt: null },
          select: IDENTITY_SELECT,
        });
      }
      return null;
    });
  }

  /** The student's enrollment in the school's ACTIVE academic year (drives the ACTIVE vs RETURNING case). */
  currentEnrollment(studentId: string) {
    return this.run((tx) =>
      tx.enrollment.findFirst({
        where: { studentId, academicYear: { status: 'ACTIVE' } },
        select: {
          id: true,
          status: true,
          grade: { select: { nameEn: true } },
          academicYear: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /**
   * Informational similar-name search (Step 6). Returns live students whose any name part matches — used
   * ONLY to warn the registrar of a possible duplicate. It is NEVER the identity check and never blocks
   * admission (identity is National ID / MoE exact match only).
   */
  similarByName(query: string): Promise<IdentityStudent[]> {
    const contains: Prisma.StringFilter = { contains: query.trim(), mode: 'insensitive' };
    return this.run((tx) =>
      tx.student.findMany({
        where: {
          deletedAt: null,
          OR: [
            { firstNameEn: contains },
            { firstNameAr: contains },
            { fatherNameEn: contains },
            { fatherNameAr: contains },
            { lastNameEn: contains },
            { lastNameAr: contains },
          ],
        },
        select: IDENTITY_SELECT,
        take: 10,
        orderBy: { lastNameEn: 'asc' },
      }),
    );
  }
}
