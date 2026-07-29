import { Injectable } from '@nestjs/common';
import type { InventoryItem, InventoryTransaction, InventoryTxnType, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

/** Thrown when an OUT transaction would drive stock negative (mapped to 409). */
export class InsufficientStockError extends Error {
  constructor() {
    super('Insufficient stock for this transaction');
    this.name = 'InsufficientStockError';
  }
}

@Injectable()
export class InventoryRepository extends TenantRepository {
  createItem(
    data: Omit<Prisma.InventoryItemUncheckedCreateInput, 'tenantId'>,
  ): Promise<InventoryItem> {
    return this.run((tx, tenantId) => tx.inventoryItem.create({ data: { ...data, tenantId } }));
  }

  listItems(): Promise<InventoryItem[]> {
    return this.run((tx) =>
      tx.inventoryItem.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        take: 500,
      }),
    );
  }

  findItem(id: string): Promise<InventoryItem | null> {
    return this.run((tx) => tx.inventoryItem.findFirst({ where: { id, deletedAt: null } }));
  }

  /**
   * Apply a stock movement atomically: compute the new quantity (IN adds, OUT subtracts, ADJUST
   * sets), guard against negatives, update the item, and record the transaction.
   */
  applyTransaction(data: {
    itemId: string;
    type: InventoryTxnType;
    quantity: number;
    reason: string | null;
  }): Promise<InventoryTransaction> {
    return this.run(async (tx, tenantId) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: data.itemId, deletedAt: null },
      });
      if (!item) throw new InsufficientStockError(); // service guards existence first

      let next: number;
      if (data.type === 'IN') next = item.quantity + data.quantity;
      else if (data.type === 'OUT') next = item.quantity - data.quantity;
      else next = data.quantity; // ADJUST sets the absolute count
      if (next < 0) throw new InsufficientStockError();

      await tx.inventoryItem.update({ where: { id: data.itemId }, data: { quantity: next } });
      return tx.inventoryTransaction.create({
        data: {
          tenantId,
          itemId: data.itemId,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason,
          recordedById: TenantContextStore.get()?.actorUserId ?? null,
        },
      });
    });
  }

  listTransactions(itemId?: string): Promise<InventoryTransaction[]> {
    return this.run((tx) =>
      tx.inventoryTransaction.findMany({
        where: { ...(itemId ? { itemId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    );
  }

  itemExists(itemId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.inventoryItem.findFirst({ where: { id: itemId, deletedAt: null } })) !== null,
    );
  }
}
