import { BadRequestException, Injectable } from '@nestjs/common';
import type { Announcement } from '@prisma/client';
import { AnnouncementRepository } from './announcement.repository';
import { NotificationEventBus } from '../engine/notification-event-bus';
import { NotificationEventType } from '../engine/notification-events';
import type { CreateAnnouncementDto } from './announcement.dto';

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly repo: AnnouncementRepository,
    private readonly bus: NotificationEventBus,
  ) {}

  async create(dto: CreateAnnouncementDto): Promise<Announcement & { recipients: number }> {
    if (
      dto.audience === 'SECTION' &&
      dto.sectionId &&
      !(await this.repo.sectionExists(dto.sectionId))
    ) {
      throw new BadRequestException('Section not found in this tenant');
    }
    const announcement = await this.repo.create({
      title: dto.title,
      body: dto.body,
      audience: dto.audience,
      sectionId: dto.sectionId ?? null,
    });

    // Modules never send directly — raise an event; the engine handles preference/priority/channels.
    const { recipients } = await this.bus.emit({
      type: NotificationEventType.AnnouncementCreated,
      recipients: { audience: dto.audience, sectionId: dto.sectionId ?? null },
      title: dto.title,
      body: dto.body,
      context: { Body: dto.body },
      announcementId: announcement.id,
    });

    return { ...announcement, recipients };
  }

  list(): Promise<Announcement[]> {
    return this.repo.findMany();
  }
}
