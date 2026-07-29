import { Injectable } from '@nestjs/common';
import type {
  Achievement,
  AttendanceStatus,
  Prisma,
  StudentAchievement,
  StudentGamification,
} from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class GamificationRepository extends TenantRepository {
  // ----- Achievement catalog (staff) ----------------------------------------
  createAchievement(
    data: Omit<Prisma.AchievementUncheckedCreateInput, 'tenantId'>,
  ): Promise<Achievement> {
    return this.run((tx, tenantId) => tx.achievement.create({ data: { ...data, tenantId } }));
  }

  listAchievements(): Promise<Achievement[]> {
    return this.run((tx) => tx.achievement.findMany({ orderBy: { createdAt: 'asc' }, take: 500 }));
  }

  findAchievement(id: string): Promise<Achievement | null> {
    return this.run((tx) => tx.achievement.findFirst({ where: { id } }));
  }

  /** Active achievements whose award is driven by attendance metrics. */
  autoAchievements(): Promise<Achievement[]> {
    return this.run((tx) =>
      tx.achievement.findMany({
        where: {
          isActive: true,
          category: { in: ['ATTENDANCE_STREAK', 'ATTENDANCE_TOTAL'] },
        },
      }),
    );
  }

  // ----- Earned achievements -------------------------------------------------
  earnedFor(studentId: string): Promise<Array<StudentAchievement & { achievement: Achievement }>> {
    return this.run((tx) =>
      tx.studentAchievement.findMany({
        where: { studentId },
        include: { achievement: true },
        orderBy: { earnedAt: 'desc' },
      }),
    );
  }

  /** Idempotently award an achievement (no-op if already earned). Returns true if newly awarded. */
  awardIfAbsent(
    studentId: string,
    achievementId: string,
    awardedById: string | null,
    note: string | null,
  ): Promise<boolean> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.studentAchievement.findFirst({
        where: { studentId, achievementId },
      });
      if (existing) return false;
      await tx.studentAchievement.create({
        data: { tenantId, studentId, achievementId, awardedById, note },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'achievement.award',
        entityType: 'StudentAchievement',
        metadata: { studentId, achievementId },
      });
      return true;
    });
  }

  // ----- Attendance metrics --------------------------------------------------
  /** All attendance rows for a student (date + status), most recent first. */
  attendanceRows(studentId: string): Promise<Array<{ date: Date; status: AttendanceStatus }>> {
    return this.run((tx) =>
      tx.studentAttendance.findMany({
        where: { studentId },
        select: { date: true, status: true },
        orderBy: { date: 'desc' },
      }),
    );
  }

  // ----- Gamification rollup -------------------------------------------------
  gamificationFor(studentId: string): Promise<StudentGamification | null> {
    return this.run((tx) => tx.studentGamification.findFirst({ where: { studentId } }));
  }

  upsertGamification(
    studentId: string,
    data: {
      totalPoints: number;
      level: number;
      currentStreak: number;
      longestStreak: number;
    },
  ): Promise<StudentGamification> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.studentGamification.findFirst({ where: { studentId } });
      const payload = { ...data, lastSyncedAt: new Date() };
      if (existing) {
        return tx.studentGamification.update({ where: { id: existing.id }, data: payload });
      }
      return tx.studentGamification.create({ data: { tenantId, studentId, ...payload } });
    });
  }

  sumEarnedPoints(studentId: string): Promise<number> {
    return this.run(async (tx) => {
      const earned = await tx.studentAchievement.findMany({
        where: { studentId },
        include: { achievement: { select: { points: true } } },
      });
      return earned.reduce((sum, e) => sum + e.achievement.points, 0);
    });
  }

  studentExists(studentId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.student.findFirst({ where: { id: studentId, deletedAt: null } })) !== null,
    );
  }
}
