import { Injectable } from '@nestjs/common';
import { Prisma, type CardStatus, type CardType, type StudentCard } from '@prisma/client';
import { TenantRepository } from '../common/tenant.repository';
import { TenantContextStore } from '../prisma/tenant-context';

/** Thrown when issuing a card whose UID already exists in the tenant. */
export class DuplicateCardError extends Error {
  constructor() {
    super('A card with this UID already exists');
    this.name = 'DuplicateCardError';
  }
}

@Injectable()
export class CardsRepository extends TenantRepository {
  studentExists(studentId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.student.findFirst({ where: { id: studentId, deletedAt: null } })) !== null,
    );
  }

  issue(data: {
    studentId: string;
    cardUid: string;
    type: CardType;
    label: string | null;
  }): Promise<StudentCard> {
    return this.run(async (tx, tenantId) => {
      try {
        const card = await tx.studentCard.create({
          data: { tenantId, ...data, issuedById: TenantContextStore.get()?.actorUserId ?? null },
        });
        await this.writeAudit(tx, tenantId, {
          action: 'card.issue',
          entityType: 'StudentCard',
          entityId: card.id,
          metadata: { studentId: data.studentId, cardUid: data.cardUid, type: data.type },
        });
        return card;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new DuplicateCardError();
        }
        throw e;
      }
    });
  }

  list(studentId?: string): Promise<StudentCard[]> {
    return this.run((tx, tenantId) =>
      tx.studentCard.findMany({
        where: { tenantId, ...(studentId ? { studentId } : {}) },
        orderBy: { issuedAt: 'desc' },
        take: 500,
      }),
    );
  }

  findById(id: string): Promise<StudentCard | null> {
    return this.run((tx) => tx.studentCard.findFirst({ where: { id } }));
  }

  update(id: string, data: { status?: CardStatus; label?: string }): Promise<StudentCard> {
    return this.run(async (tx, tenantId) => {
      const card = await tx.studentCard.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'card.update',
        entityType: 'StudentCard',
        entityId: card.id,
        metadata: { ...data },
      });
      return card;
    });
  }

  remove(id: string): Promise<void> {
    return this.run(async (tx, tenantId) => {
      await tx.studentCard.delete({ where: { id } });
      await this.writeAudit(tx, tenantId, {
        action: 'card.delete',
        entityType: 'StudentCard',
        entityId: id,
      });
    });
  }

  /** Resolve a card UID → studentId — only when the card is ACTIVE (and matching type if given). */
  resolveActive(cardUid: string, type?: CardType): Promise<string | null> {
    return this.run(async (tx, tenantId) => {
      const card = await tx.studentCard.findFirst({
        where: { tenantId, cardUid, status: 'ACTIVE', ...(type ? { type } : {}) },
        select: { studentId: true },
      });
      return card?.studentId ?? null;
    });
  }
}
