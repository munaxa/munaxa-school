import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CardType, StudentCard } from '@prisma/client';
import { CardsRepository, DuplicateCardError } from './cards.repository';
import type { IssueCardDto, UpdateCardDto } from './cards.dto';

@Injectable()
export class CardsService {
  constructor(private readonly repo: CardsRepository) {}

  async issue(dto: IssueCardDto): Promise<StudentCard> {
    if (!(await this.repo.studentExists(dto.studentId))) {
      throw new BadRequestException('Student not found in this tenant');
    }
    try {
      return await this.repo.issue({
        studentId: dto.studentId,
        cardUid: dto.cardUid.trim(),
        type: dto.type ?? 'NFC',
        label: dto.label ?? null,
      });
    } catch (e) {
      if (e instanceof DuplicateCardError) throw new ConflictException(e.message);
      throw e;
    }
  }

  list(studentId?: string): Promise<StudentCard[]> {
    return this.repo.list(studentId);
  }

  async get(id: string): Promise<StudentCard> {
    const card = await this.repo.findById(id);
    if (!card) throw new NotFoundException('Card not found');
    return card;
  }

  async update(id: string, dto: UpdateCardDto): Promise<StudentCard> {
    await this.get(id);
    return this.repo.update(id, {
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.label !== undefined ? { label: dto.label } : {}),
    });
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.get(id);
    await this.repo.remove(id);
    return { deleted: true };
  }

  /** Used by NFC/RFID identification providers — resolves only ACTIVE cards. */
  resolveActive(cardUid: string, type?: CardType): Promise<string | null> {
    return this.repo.resolveActive(cardUid, type);
  }
}
