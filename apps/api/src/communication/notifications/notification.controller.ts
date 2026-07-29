import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { FeedQueryDto } from './notification.dto';
import { DeviceRepository } from '../devices/device.repository';
import { RegisterDeviceDto } from '../devices/device.dto';
import { PreferenceService } from '../preferences/preference.service';
import { UpdatePreferenceDto } from '../preferences/preference.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/auth.types';

/** The notification center, preferences, and device registration — scoped to the current user. */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(
    private readonly service: NotificationService,
    private readonly devices: DeviceRepository,
    private readonly preferences: PreferenceService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'List my notifications (filterable, cursor-paged)' })
  listMine(@CurrentUser() user: AuthenticatedUser, @Query() query: FeedQueryDto) {
    return this.service.listMine(user.userId, query);
  }

  @Get('me/unread-count')
  unread(@CurrentUser() user: AuthenticatedUser) {
    return this.service.unread(user.userId);
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.markRead(id, user.userId);
  }

  @Post('read-all')
  @HttpCode(200)
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.service.markAllRead(user.userId);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.archive(id, user.userId);
  }

  // ----- Preferences --------------------------------------------------------
  @Get('preferences')
  @ApiOperation({ summary: 'Get my notification preferences (lazily created)' })
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.preferences.getMine(user.userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update my notification preferences' })
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePreferenceDto) {
    return this.preferences.updateMine(user.userId, dto);
  }

  // ----- Device tokens (FCM) ------------------------------------------------
  @Post('devices')
  @ApiOperation({ summary: 'Register this device for push notifications' })
  registerDevice(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDeviceDto) {
    return this.devices.register(user.userId, dto.token, dto.platform, dto.deviceType);
  }

  @Delete('devices/:token')
  @HttpCode(204)
  async removeDevice(@CurrentUser() user: AuthenticatedUser, @Param('token') token: string) {
    await this.devices.remove(user.userId, token);
  }
}
