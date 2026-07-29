import { Injectable } from '@nestjs/common';
import type {
  AnnouncementAudience,
  Notification,
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  Prisma,
  RoleKey,
} from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

export interface RecipientContact {
  email: string | null;
  tokens: string[];
}

export interface CreateNotificationInput {
  userId: string;
  type?: string | null;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  titleEn?: string | null;
  titleAr?: string | null;
  bodyEn?: string | null;
  bodyAr?: string | null;
  mandatory?: boolean;
  data?: Prisma.InputJsonValue;
  announcementId?: string | null;
}

export interface FeedFilters {
  category?: NotificationCategory;
  priority?: NotificationPriority;
  read?: boolean;
  search?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit: number;
}

@Injectable()
export class NotificationRepository extends TenantRepository {
  /** Resolve recipient userIds for an announcement audience (deduplicated). */
  resolveRecipients(audience: AnnouncementAudience, sectionId?: string | null): Promise<string[]> {
    return this.run(async (tx) => {
      const active = { status: 'ACTIVE' as const, deletedAt: null };

      if (audience === 'ALL') {
        const users = await tx.user.findMany({ where: active, select: { id: true } });
        return users.map((u) => u.id);
      }

      if (audience === 'PARENTS' || audience === 'TEACHERS' || audience === 'STUDENTS') {
        const roleKey: RoleKey =
          audience === 'PARENTS' ? 'Parent' : audience === 'TEACHERS' ? 'Teacher' : 'Student';
        const users = await tx.user.findMany({
          where: { ...active, userRoles: { some: { role: { key: roleKey } } } },
          select: { id: true },
        });
        return users.map((u) => u.id);
      }

      // SECTION: the section's students (with accounts) + their linked parents.
      if (!sectionId) return [];
      const students = await tx.student.findMany({
        where: { sectionId, deletedAt: null },
        select: { id: true, userId: true },
      });
      const links = await tx.parentStudent.findMany({
        where: { studentId: { in: students.map((s) => s.id) } },
        select: { parent: { select: { userId: true } } },
      });
      const ids = new Set<string>();
      for (const s of students) if (s.userId) ids.add(s.userId);
      for (const l of links) if (l.parent.userId) ids.add(l.parent.userId);
      return [...ids];
    });
  }

  /** Create one notification row (the engine fans out per recipient to capture delivery ids). */
  createForRecipient(input: CreateNotificationInput): Promise<Notification> {
    return this.run((tx, tenantId) =>
      tx.notification.create({
        data: {
          tenantId,
          userId: input.userId,
          type: input.type ?? null,
          category: input.category,
          priority: input.priority,
          status: 'PENDING',
          title: input.title,
          body: input.body,
          titleEn: input.titleEn ?? null,
          titleAr: input.titleAr ?? null,
          bodyEn: input.bodyEn ?? null,
          bodyAr: input.bodyAr ?? null,
          mandatory: input.mandatory ?? false,
          ...(input.data !== undefined ? { data: input.data } : {}),
          announcementId: input.announcementId ?? null,
        },
      }),
    );
  }

  setStatus(id: string, status: NotificationStatus): Promise<unknown> {
    return this.run((tx) => tx.notification.update({ where: { id }, data: { status } }));
  }

  /** Active device tokens + email per user (for channel fan-out). */
  async recipientContacts(userIds: string[]): Promise<Map<string, RecipientContact>> {
    if (userIds.length === 0) return new Map();
    const { users, tokens } = await this.run((tx) =>
      Promise.all([
        tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }),
        tx.deviceToken.findMany({
          where: { userId: { in: userIds }, active: true },
          select: { userId: true, token: true },
        }),
      ]).then(([users, tokens]) => ({ users, tokens })),
    );
    const map = new Map<string, RecipientContact>();
    for (const u of users) map.set(u.id, { email: u.email, tokens: [] });
    for (const t of tokens) map.get(t.userId)?.tokens.push(t.token);
    return map;
  }

  // ----- Notification center -------------------------------------------------

  /** Cursor-paged, filterable feed for one user (infinite scroll). */
  listForUser(userId: string, filters: FeedFilters): Promise<Notification[]> {
    return this.run((tx) => {
      const where: Prisma.NotificationWhereInput = {
        userId,
        archivedAt: null,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
        ...(filters.read === true ? { readAt: { not: null } } : {}),
        ...(filters.read === false ? { readAt: null } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
        ...(filters.search
          ? {
              OR: [
                { title: { contains: filters.search, mode: 'insensitive' } },
                { body: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      return tx.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        ...(filters.cursor ? { skip: 1, cursor: { id: filters.cursor } } : {}),
      });
    });
  }

  unreadCount(userId: string): Promise<number> {
    return this.run((tx) =>
      tx.notification.count({ where: { userId, readAt: null, archivedAt: null } }),
    );
  }

  markRead(id: string, userId: string): Promise<Prisma.BatchPayload> {
    return this.run((tx) =>
      tx.notification.updateMany({
        where: { id, userId, readAt: null },
        data: { readAt: new Date(), status: 'READ' },
      }),
    );
  }

  markAllRead(userId: string): Promise<Prisma.BatchPayload> {
    return this.run((tx) =>
      tx.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date(), status: 'READ' },
      }),
    );
  }

  archive(id: string, userId: string): Promise<Prisma.BatchPayload> {
    return this.run((tx) =>
      tx.notification.updateMany({
        where: { id, userId, archivedAt: null },
        data: { archivedAt: new Date(), status: 'ARCHIVED' },
      }),
    );
  }
}
