import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { SettingsService } from './settings.service';
import { UpdateNotificationSettingsDto } from './settings.dto';

/** Admin-managed tenant notification settings (sender identity + global channel toggles). */
@ApiTags('notification-settings')
@ApiBearerAuth()
@Controller({ path: 'notifications/settings', version: '1' })
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @RequirePermissions(Permission.NOTIFICATION_SETTINGS)
  @ApiOperation({ summary: 'Get this tenant’s notification settings (lazily created)' })
  get() {
    return this.service.get();
  }

  @Put()
  @RequirePermissions(Permission.NOTIFICATION_SETTINGS)
  @ApiOperation({ summary: 'Update sender identity / global channel toggles' })
  update(@Body() dto: UpdateNotificationSettingsDto) {
    return this.service.update(dto);
  }
}
