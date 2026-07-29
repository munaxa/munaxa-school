import { Injectable } from '@nestjs/common';
import type { NotificationPreference } from '@prisma/client';
import { PreferenceRepository } from './preference.repository';
import type { UpdatePreferenceDto } from './preference.dto';

@Injectable()
export class PreferenceService {
  constructor(private readonly repo: PreferenceRepository) {}

  getMine(userId: string): Promise<NotificationPreference> {
    return this.repo.getOrCreate(userId);
  }

  updateMine(userId: string, dto: UpdatePreferenceDto): Promise<NotificationPreference> {
    return this.repo.update(userId, dto);
  }
}
