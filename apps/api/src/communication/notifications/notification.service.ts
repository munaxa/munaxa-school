import { Injectable } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { NotificationRepository, type FeedFilters } from './notification.repository';
import type { FeedQueryDto } from './notification.dto';

/** The in-app notification center, always scoped to the current user. */
@Injectable()
export class NotificationService {
  constructor(private readonly repo: NotificationRepository) {}

  listMine(userId: string, query: FeedQueryDto): Promise<Notification[]> {
    const filters: FeedFilters = {
      limit: query.limit ?? 25,
      category: query.category,
      priority: query.priority,
      read: query.read === undefined ? undefined : query.read === 'true',
      search: query.search,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      cursor: query.cursor,
    };
    return this.repo.listForUser(userId, filters);
  }

  async unread(userId: string): Promise<{ count: number }> {
    return { count: await this.repo.unreadCount(userId) };
  }

  async markRead(id: string, userId: string): Promise<{ updated: number }> {
    const result = await this.repo.markRead(id, userId);
    return { updated: result.count };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.repo.markAllRead(userId);
    return { updated: result.count };
  }

  async archive(id: string, userId: string): Promise<{ updated: number }> {
    const result = await this.repo.archive(id, userId);
    return { updated: result.count };
  }
}
