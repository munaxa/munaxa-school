import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AssetService } from './asset.service';
import {
  AssignAssetDto,
  CreateAssetDto,
  ListAssetsQueryDto,
  ReturnAssetDto,
  UpdateAssetDto,
} from './asset.dto';

/** Asset register + custody (assign/return). */
@ApiTags('assets')
@ApiBearerAuth()
@Controller({ path: 'hr/assets', version: '1' })
export class AssetController {
  constructor(private readonly service: AssetService) {}

  @Get()
  @RequirePermissions(Permission.ASSET_READ)
  list(@Query() query: ListAssetsQueryDto) {
    return this.service.listAssets(query);
  }

  @Post()
  @RequirePermissions(Permission.ASSET_MANAGE)
  create(@Body() dto: CreateAssetDto) {
    return this.service.createAsset(dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.ASSET_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getAsset(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ASSET_MANAGE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetDto) {
    return this.service.updateAsset(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.ASSET_MANAGE)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeAsset(id);
  }

  @Post(':id/assign')
  @RequirePermissions(Permission.ASSET_MANAGE)
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignAssetDto) {
    return this.service.assign(id, dto);
  }

  @Post(':id/return')
  @RequirePermissions(Permission.ASSET_MANAGE)
  returnAsset(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReturnAssetDto) {
    return this.service.return(id, dto);
  }
}

/** Employee-scoped view of assets currently or previously in their custody. */
@ApiTags('assets')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId/assets', version: '1' })
export class EmployeeAssetController {
  constructor(private readonly service: AssetService) {}

  @Get()
  @RequirePermissions(Permission.ASSET_READ)
  list(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.listForEmployee(employeeId);
  }
}
