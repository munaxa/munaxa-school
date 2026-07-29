import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AcademicYearStatus, EnrollmentStatus } from '@prisma/client';
import { TenantRepository } from '../common/tenant.repository';
import type { TxClient } from '../prisma/tenant.helpers';
import type { CorrectGradeDto, TransferDto } from './enrollment-change.dto';

/**
 * Data access for enrollment placement changes (Grade Correction / Administrative Transfer). ALL
 * academic placement lives on the Enrollment (Decisions 4 & 13) — the Student is never edited for
 * grade/section/classroom. The deprecated `Student.sectionId` shim is kept in sync as a read-through
 * cache (the same pattern EnrollmentLifecycleService uses for `Student.status`). No ledger changes
 * here (PR 1) — every change is fully audited.
 */
@Injectable()
export class EnrollmentChangeRepository extends TenantRepository {
  /** Load the enrollment and refuse to change anything that is not the current, active-year record. */
  private async loadChangeable(tx: TxClient, enrollmentId: string) {
    const e = await tx.enrollment.findFirst({
      where: { id: enrollmentId },
      select: {
        id: true,
        studentId: true,
        gradeId: true,
        sectionId: true,
        classroomId: true,
        status: true,
        academicYear: { select: { status: true } },
      },
    });
    if (!e) throw new NotFoundException('Enrollment not found');
    if (
      e.academicYear?.status !== AcademicYearStatus.ACTIVE ||
      e.status !== EnrollmentStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'Only the current active-year enrollment can be changed. Past years are immutable history; ' +
          'use Year-End Processing for promotion or repetition.',
      );
    }
    return e;
  }

  /** Administrative Transfer — new section within the SAME grade; sync the section/classroom + shim. */
  transfer(enrollmentId: string, dto: TransferDto) {
    return this.run(async (tx, tenantId) => {
      const e = await this.loadChangeable(tx, enrollmentId);
      const section = await tx.section.findFirst({
        where: { id: dto.sectionId },
        select: { gradeId: true, classroomId: true },
      });
      if (!section) throw new BadRequestException('Section not found');
      if (section.gradeId !== e.gradeId) {
        throw new BadRequestException(
          'That section belongs to a different grade — use Grade Correction to change the grade.',
        );
      }

      const updated = await tx.enrollment.update({
        where: { id: enrollmentId },
        data: { sectionId: dto.sectionId, classroomId: section.classroomId ?? null },
      });
      // Read-through shim (placement stays authoritative on the Enrollment).
      await tx.student.update({ where: { id: e.studentId }, data: { sectionId: dto.sectionId } });

      // Full before/after placement (grade unchanged on a transfer) so the audit trail reconstructs
      // the complete history. writeAudit also stamps the actor (user) and timestamp.
      await this.writeAudit(tx, tenantId, {
        action: 'enrollment.transfer',
        entityType: 'Enrollment',
        entityId: enrollmentId,
        metadata: {
          fromGradeId: e.gradeId,
          toGradeId: e.gradeId,
          fromSectionId: e.sectionId,
          toSectionId: dto.sectionId,
          fromClassroomId: e.classroomId,
          toClassroomId: section.classroomId ?? null,
          ...(dto.reason ? { reason: dto.reason } : {}),
        },
      });
      return updated;
    });
  }

  /**
   * Data-entry Grade Correction — corrects the grade (+ optional section/classroom) on the current
   * enrollment. Returns whether the grade actually changed so the caller can warn about fees (PR 1
   * never modifies the ledger).
   */
  correctGrade(enrollmentId: string, dto: CorrectGradeDto) {
    return this.run(async (tx, tenantId) => {
      const e = await this.loadChangeable(tx, enrollmentId);
      const grade = await tx.grade.findFirst({ where: { id: dto.gradeId }, select: { id: true } });
      if (!grade) throw new BadRequestException('Grade not found');

      let sectionId: string | null = null;
      let classroomId: string | null = null;
      if (dto.sectionId) {
        const section = await tx.section.findFirst({
          where: { id: dto.sectionId },
          select: { gradeId: true, classroomId: true },
        });
        if (!section) throw new BadRequestException('Section not found');
        if (section.gradeId !== dto.gradeId) {
          throw new BadRequestException(
            'The selected section does not belong to the chosen grade.',
          );
        }
        sectionId = dto.sectionId;
        classroomId = section.classroomId ?? null;
      }

      const updated = await tx.enrollment.update({
        where: { id: enrollmentId },
        data: { gradeId: dto.gradeId, sectionId, classroomId },
      });
      await tx.student.update({ where: { id: e.studentId }, data: { sectionId } });

      // Full before/after placement so the audit trail reconstructs the complete history. writeAudit
      // also stamps the actor (user) and timestamp.
      await this.writeAudit(tx, tenantId, {
        action: 'enrollment.gradeCorrection',
        entityType: 'Enrollment',
        entityId: enrollmentId,
        metadata: {
          fromGradeId: e.gradeId,
          toGradeId: dto.gradeId,
          fromSectionId: e.sectionId,
          toSectionId: sectionId,
          fromClassroomId: e.classroomId,
          toClassroomId: classroomId,
          ...(dto.reason ? { reason: dto.reason } : {}),
        },
      });
      return { enrollment: updated, feesMayChange: e.gradeId !== dto.gradeId };
    });
  }
}
