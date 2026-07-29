import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { FeatureFlagGuard } from '../../feature-flags/feature-flag.guard';
import { FeatureFlagKey, RequireFeature } from '../../feature-flags/require-feature.decorator';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto, InventoryTxnDto } from './inventory.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller({ path: 'inventory', version: '1' })
@UseGuards(FeatureFlagGuard)
@RequireFeature(FeatureFlagKey.INVENTORY_MANAGEMENT)
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Post('items')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({ summary: 'Create an inventory item' })
  createItem(@Body() dto: CreateInventoryItemDto) {
    return this.service.createItem(dto);
  }

  @Get('items')
  @RequirePermissions(Permission.INVENTORY_READ)
  listItems() {
    return this.service.listItems();
  }

  @Post('transactions')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({ summary: 'Record a stock movement (IN / OUT / ADJUST)' })
  recordTransaction(@Body() dto: InventoryTxnDto) {
    return this.service.recordTransaction(dto);
  }

  @Get('transactions')
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiQuery({ name: 'itemId', required: false })
  listTransactions(@Query('itemId') itemId?: string) {
    return this.service.listTransactions(itemId);
  }
}
