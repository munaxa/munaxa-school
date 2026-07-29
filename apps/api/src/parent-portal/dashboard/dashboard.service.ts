import { Injectable, NotFoundException } from '@nestjs/common';
import type { GradeRecord } from '@prisma/client';
import { ParentScopeService } from '../common/parent-scope.service';
import { SchedulingService } from '../../scheduling/scheduling.service';
import { DashboardRepository, type AttendanceSummary } from './dashboard.repository';

export interface ChildDashboard {
  student: {
    id: string;
    firstNameEn: string;
    lastNameEn: string;
    firstNameAr: string;
    lastNameAr: string;
    sectionId: string | null;
    status: string;
  };
  attendanceLast30Days: AttendanceSummary;
  upcomingHomework: number;
  recentGrades: GradeRecord[];
  outstandingBalance: string;
  pendingLeaveRequests: number;
  upcomingPtmBookings: number;
  documentCount: number;
  unreadNotifications: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly repo: DashboardRepository,
    private readonly scope: ParentScopeService,
    private readonly scheduling: SchedulingService,
  ) {}

  /** Multi-child switcher: the children linked to the acting parent. */
  children() {
    return this.scope.children();
  }

  /** A child's inherited weekly timetable (via the section's published plan). */
  async childTimetable(studentId: string) {
    await this.scope.assertChildAccess(studentId);
    const student = await this.repo.student(studentId);
    if (!student) throw new NotFoundException('Student not found');
    return this.scheduling.getStudentSchedule(student.sectionId);
  }

  /** "Now Attending" live card for a child (current/next class, remaining time, state). */
  async childCurrentClass(studentId: string) {
    await this.scope.assertChildAccess(studentId);
    const student = await this.repo.student(studentId);
    if (!student) throw new NotFoundException('Student not found');
    return this.scheduling.getStudentCurrentClass(student.sectionId);
  }

  /**
   * The family finance landing: Family Outstanding, Next Installment, Total Paid, Payment History and
   * the children (each with their own outstanding). The default finance view for a guardian; clicking
   * a child opens the per-child detail without losing this family summary.
   */
  async familyFinance() {
    const parentId = await this.scope.myParentId();
    if (!parentId) throw new NotFoundException('No guardian profile for the current user');
    return this.repo.familyFinance(parentId);
  }

  async childDashboard(studentId: string): Promise<ChildDashboard> {
    await this.scope.assertChildAccess(studentId);
    const student = await this.repo.student(studentId);
    if (!student) throw new NotFoundException('Student not found');

    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      attendance,
      upcomingHomework,
      recentGrades,
      outstandingBalance,
      pendingLeaveRequests,
      upcomingPtmBookings,
      documentCount,
      unreadNotifications,
    ] = await Promise.all([
      this.repo.attendanceSummary(studentId, since),
      this.repo.upcomingHomeworkCount(student.sectionId, now),
      this.repo.recentGrades(studentId),
      this.repo.outstandingBalance(studentId),
      this.repo.pendingLeaveCount(studentId),
      this.repo.upcomingPtmCount(studentId, now),
      this.repo.documentCount(studentId),
      this.repo.unreadNotificationCount(),
    ]);

    return {
      student: {
        id: student.id,
        firstNameEn: student.firstNameEn,
        lastNameEn: student.lastNameEn,
        firstNameAr: student.firstNameAr,
        lastNameAr: student.lastNameAr,
        sectionId: student.sectionId,
        status: student.status,
      },
      attendanceLast30Days: attendance,
      upcomingHomework,
      recentGrades,
      outstandingBalance,
      pendingLeaveRequests,
      upcomingPtmBookings,
      documentCount,
      unreadNotifications,
    };
  }
}
