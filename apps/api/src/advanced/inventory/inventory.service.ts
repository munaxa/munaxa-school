import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { InventoryItem, InventoryTransaction } from '@prisma/client';
import { InsufficientStockError, InventoryRepository } from './inventory.repository';
import type { CreateInventoryItemDto, InventoryTxnDto } from './inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly repo: InventoryRepository) {}

  createItem(dto: CreateInventoryItemDto): Promise<InventoryItem> {
    return this.repo.createItem({
      name: dto.name,
      sku: dto.sku ?? null,
      category: dto.category ?? null,
      unit: dto.unit ?? null,
      quantity: dto.quantity ?? 0,
      reorderLevel: dto.reorderLevel ?? null,
      location: dto.location ?? null,
    });
  }

  listItems(): Promise<InventoryItem[]> {
    return this.repo.listItems();
  }

  async recordTransaction(dto: InventoryTxnDto): Promise<InventoryTransaction> {
    if (!(await this.repo.itemExists(dto.itemId))) {
      throw new NotFoundException('Inventory item not found');
    }
    try {
      return await this.repo.applyTransaction({
        itemId: dto.itemId,
        type: dto.type,
        quantity: dto.quantity,
        reason: dto.reason ?? null,
      });
    } catch (err) {
      if (err instanceof InsufficientStockError) throw new ConflictException(err.message);
      throw err;
    }
  }

  listTransactions(itemId?: string): Promise<InventoryTransaction[]> {
    return this.repo.listTransactions(itemId);
  }
}
