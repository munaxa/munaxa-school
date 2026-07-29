import { Injectable } from '@nestjs/common';
import type { GradeRecord, Homework, StudentAttendance } from '@prisma/client';
import { StudentScopeService } from '../common/student-scope.service';
import { ResourceService, type ResourceView } from '../resources/resource.service';
import {
  GamificationService,
  type GamificationSummary,
} from '../gamification/gamification.service';
import { SchedulingService } from '../../scheduling/scheduling.service';
import { MeRepository, type AttendanceSummary } from './me.repository';

export interface StudentDashboard {
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
  gamification: {
    totalPoints: number;
    level: number;
    currentStreak: number;
    longestStreak: number;
    achievementCount: number;
  };
  unreadNotifications: number;
}

@Injectable()
export class MeService {
  constructor(
    private readonly repo: MeRepository,
    private readonly scope: StudentScopeService,
    private readonly resources: ResourceService,
    private readonly gamification: GamificationService,
    private readonly scheduling: SchedulingService,
  ) {}

  async dashboard(): Promise<StudentDashboard> {
    const student = await this.scope.requireStudent();
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [attendance, upcomingHomework, recentGrades, gami, unread] = await Promise.all([
      this.repo.attendanceSummary(student.id, since),
      student.sectionId
        ? this.repo.upcomingHomeworkCount(student.sectionId, now)
        : Promise.resolve(0),
      this.repo.recentGrades(student.id),
      this.gamification.summary(student.id),
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
      gamification: {
        totalPoints: gami.totalPoints,
        level: gami.level,
        currentStreak: gami.currentStreak,
        longestStreak: gami.longestStreak,
        achievementCount: gami.achievements.length,
      },
      unreadNotifications: unread,
    };
  }

  async homework(): Promise<Homework[]> {
    const student = await this.scope.requireStudent();
    if (!student.sectionId) return [];
    return this.repo.homeworkForSection(student.sectionId);
  }

  async attendance(): Promise<StudentAttendance[]> {
    const studentId = await this.scope.requireStudentId();
    return this.repo.attendanceHistory(studentId);
  }

  // The student's weekly timetable is inherited from their section's PUBLISHED SchedulePlan, resolved
  // by the platform SchedulingService (no per-student timetable records exist).
  async timetable() {
    const student = await this.scope.requireStudent();
    return this.scheduling.getStudentSchedule(student.sectionId);
  }

  /** Live "now attending / next class" for the student app dashboard. */
  async liveClass() {
    const student = await this.scope.requireStudent();
    return this.scheduling.getStudentCurrentClass(student.sectionId);
  }

  async resourceLibrary(): Promise<ResourceView[]> {
    const student = await this.scope.requireStudent();
    return this.resources.listForStudent(student.sectionId);
  }

  async gamificationSummary(): Promise<GamificationSummary> {
    const studentId = await this.scope.requireStudentId();
    return this.gamification.summary(studentId);
  }

  async achievements() {
    const studentId = await this.scope.requireStudentId();
    return this.gamification.earnedFor(studentId);
  }
}
