import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Achievement, AttendanceStatus, StudentAchievement } from '@prisma/client';
import { TenantContextStore } from '../../prisma/tenant-context';
import { GamificationRepository } from './gamification.repository';

const POINTS_PER_LEVEL = 100;

export interface StreakMetrics {
  currentStreak: number;
  longestStreak: number;
  totalPresentDays: number;
}

export interface GamificationSummary {
  studentId: string;
  totalPoints: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  totalPresentDays: number;
  achievements: Array<StudentAchievement & { achievement: Achievement }>;
}

@Injectable()
export class GamificationService {
  constructor(private readonly repo: GamificationRepository) {}

  // ----- Achievement catalog (staff) ----------------------------------------
  createAchievement(data: {
    key: string;
    nameEn: string;
    nameAr: string;
    description?: string;
    icon?: string;
    category: Achievement['category'];
    points?: number;
    threshold?: number;
  }): Promise<Achievement> {
    return this.repo.createAchievement({
      key: data.key,
      nameEn: data.nameEn,
      nameAr: data.nameAr,
      description: data.description ?? null,
      icon: data.icon ?? null,
      category: data.category,
      points: data.points ?? 0,
      threshold: data.threshold ?? null,
    });
  }

  listAchievements(): Promise<Achievement[]> {
    return this.repo.listAchievements();
  }

  /** Manually award an achievement to a student (for ACADEMIC/GENERAL badges). */
  async award(
    achievementId: string,
    studentId: string,
    note?: string,
  ): Promise<GamificationSummary> {
    const achievement = await this.repo.findAchievement(achievementId);
    if (!achievement) throw new NotFoundException('Achievement not found');
    if (
      achievement.category === 'ATTENDANCE_STREAK' ||
      achievement.category === 'ATTENDANCE_TOTAL'
    ) {
      throw new BadRequestException('Attendance achievements are awarded automatically via sync');
    }
    if (!(await this.repo.studentExists(studentId))) {
      throw new BadRequestException('Student not found in this tenant');
    }
    await this.repo.awardIfAbsent(
      studentId,
      achievementId,
      TenantContextStore.get()?.actorUserId ?? null,
      note ?? null,
    );
    return this.sync(studentId);
  }

  // ----- Sync (recompute streaks, auto-award, points/level) ------------------
  /**
   * Recompute a student's attendance streaks, auto-award attendance achievements, then
   * recompute total points (sum of earned achievement points) and level. Idempotent.
   */
  async sync(studentId: string): Promise<GamificationSummary> {
    const rows = await this.repo.attendanceRows(studentId);
    const metrics = computeStreaks(rows);

    const auto = await this.repo.autoAchievements();
    for (const a of auto) {
      const metric =
        a.category === 'ATTENDANCE_STREAK' ? metrics.longestStreak : metrics.totalPresentDays;
      if (a.threshold !== null && metric >= a.threshold) {
        await this.repo.awardIfAbsent(studentId, a.id, null, null);
      }
    }

    const totalPoints = await this.repo.sumEarnedPoints(studentId);
    const level = Math.floor(totalPoints / POINTS_PER_LEVEL) + 1;
    await this.repo.upsertGamification(studentId, {
      totalPoints,
      level,
      currentStreak: metrics.currentStreak,
      longestStreak: metrics.longestStreak,
    });

    return {
      studentId,
      totalPoints,
      level,
      currentStreak: metrics.currentStreak,
      longestStreak: metrics.longestStreak,
      totalPresentDays: metrics.totalPresentDays,
      achievements: await this.repo.earnedFor(studentId),
    };
  }

  /** Fresh summary for a student (recomputes streaks/points; idempotent). */
  summary(studentId: string): Promise<GamificationSummary> {
    return this.sync(studentId);
  }

  earnedFor(studentId: string) {
    return this.repo.earnedFor(studentId);
  }
}

/**
 * Compute attendance streaks from per-period rows. Rows are collapsed to one status per day
 * (worst wins: any ABSENT marks the day absent; else LATE; else PRESENT; else EXCUSED).
 * PRESENT/LATE continue a streak, ABSENT breaks it, EXCUSED is neutral (skipped).
 */
export function computeStreaks(
  rows: Array<{ date: Date; status: AttendanceStatus }>,
): StreakMetrics {
  const rank: Record<AttendanceStatus, number> = { ABSENT: 0, LATE: 1, PRESENT: 2, EXCUSED: 3 };
  const perDay = new Map<string, AttendanceStatus>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    const current = perDay.get(key);
    if (current === undefined || rank[row.status] < rank[current]) {
      perDay.set(key, row.status);
    }
  }
  // Days, most recent first.
  const days = [...perDay.entries()]
    .map(([date, status]) => ({ date, status }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  let currentStreak = 0;
  let currentDone = false;
  let longestStreak = 0;
  let run = 0;
  let totalPresentDays = 0;

  for (const day of days) {
    const isPresent = day.status === 'PRESENT' || day.status === 'LATE';
    if (day.status === 'EXCUSED') {
      // Neutral: doesn't break or extend.
      continue;
    }
    if (isPresent) {
      totalPresentDays += 1;
      run += 1;
      if (!currentDone) currentStreak += 1;
      if (run > longestStreak) longestStreak = run;
    } else {
      // ABSENT
      run = 0;
      currentDone = true; // the current (most recent) streak has ended
    }
  }

  return { currentStreak, longestStreak, totalPresentDays };
}
