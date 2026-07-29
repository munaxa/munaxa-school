import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetStatus, type Prisma } from '@prisma/client';
import {
  AssetRepository,
  type AssetDetailView,
  type AssetView,
  type AssignmentView,
} from './asset.repository';
import type {
  AssignAssetDto,
  CreateAssetDto,
  ListAssetsQueryDto,
  ReturnAssetDto,
  UpdateAssetDto,
} from './asset.dto';

@Injectable()
export class AssetService {
  constructor(private readonly repo: AssetRepository) {}

  createAsset(dto: CreateAssetDto): Promise<AssetView> {
    return this.repo.createAsset({
      assetTag: dto.assetTag,
      name: dto.name,
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.serialNumber !== undefined ? { serialNumber: dto.serialNumber } : {}),
      ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
      ...(dto.purchaseDate !== undefined ? { purchaseDate: new Date(dto.purchaseDate) } : {}),
      ...(dto.purchaseCost !== undefined ? { purchaseCost: dto.purchaseCost } : {}),
      ...(dto.warrantyExpiry !== undefined ? { warrantyExpiry: new Date(dto.warrantyExpiry) } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });
  }

  listAssets(query: ListAssetsQueryDto): Promise<AssetView[]> {
    return this.repo.listAssets({
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
    });
  }

  async getAsset(id: string): Promise<AssetDetailView> {
    const asset = await this.repo.findAssetDetail(id);
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async updateAsset(id: string, dto: UpdateAssetDto): Promise<AssetView> {
    await this.requireAsset(id);
    const data: Prisma.AssetUncheckedUpdateInput = {};
    if (dto.assetTag !== undefined) data.assetTag = dto.assetTag;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.serialNumber !== undefined) data.serialNumber = dto.serialNumber;
    if (dto.condition !== undefined) data.condition = dto.condition;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.purchaseDate !== undefined) data.purchaseDate = new Date(dto.purchaseDate);
    if (dto.purchaseCost !== undefined) data.purchaseCost = dto.purchaseCost;
    if (dto.warrantyExpiry !== undefined) data.warrantyExpiry = new Date(dto.warrantyExpiry);
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.notes !== undefined) data.notes = dto.notes;
    return this.repo.updateAsset(id, data);
  }

  async removeAsset(id: string): Promise<void> {
    const asset = await this.requireAsset(id);
    if (asset.status === AssetStatus.ASSIGNED) {
      throw new BadRequestException('Return the asset before deleting it');
    }
    await this.repo.softDeleteAsset(id);
  }

  async assign(assetId: string, dto: AssignAssetDto): Promise<AssignmentView> {
    const asset = await this.requireAsset(assetId);
    if (asset.status !== AssetStatus.AVAILABLE) {
      throw new BadRequestException(
        `Asset is ${asset.status.toLowerCase()} and cannot be assigned`,
      );
    }
    if (!(await this.repo.employeeExists(dto.employeeId))) {
      throw new NotFoundException('Employee not found');
    }
    return this.repo.assign(
      assetId,
      dto.employeeId,
      dto.dueDate ? new Date(dto.dueDate) : null,
      dto.note ?? null,
    );
  }

  async return(assetId: string, dto: ReturnAssetDto): Promise<AssignmentView> {
    const asset = await this.requireAsset(assetId);
    if (asset.status !== AssetStatus.ASSIGNED) {
      throw new BadRequestException('Asset is not currently assigned');
    }
    const open = await this.repo.openAssignment(assetId);
    if (!open) throw new BadRequestException('No open assignment found for this asset');
    return this.repo.return(
      assetId,
      open.id,
      dto.returnCondition ?? null,
      dto.status ?? AssetStatus.AVAILABLE,
      dto.note ?? null,
    );
  }

  async listForEmployee(employeeId: string): Promise<AssignmentView[]> {
    if (!(await this.repo.employeeExists(employeeId))) {
      throw new NotFoundException('Employee not found');
    }
    return this.repo.listForEmployee(employeeId);
  }

  private async requireAsset(id: string) {
    const asset = await this.repo.findAsset(id);
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }
}
