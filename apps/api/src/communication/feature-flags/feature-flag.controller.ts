import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { FeatureFlagService } from './feature-flag.service';
import { SetFeatureFlagDto } from './feature-flag.dto';

@ApiTags('feature-flags')
@ApiBearerAuth()
@Controller({ path: 'feature-flags', version: '1' })
export class FeatureFlagController {
  constructor(private readonly service: FeatureFlagService) {}

  @Get()
  @RequirePermissions(Permission.FEATUREFLAG_MANAGE)
  list() {
    return this.service.list();
  }

  @Put(':key')
  @RequirePermissions(Permission.FEATUREFLAG_MANAGE)
  set(@Param('key') key: string, @Body() dto: SetFeatureFlagDto) {
    return this.service.set(key, dto);
  }
}
