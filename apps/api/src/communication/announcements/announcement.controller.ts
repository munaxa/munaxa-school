import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto } from './announcement.dto';

@ApiTags('announcements')
@ApiBearerAuth()
@Controller({ path: 'announcements', version: '1' })
export class AnnouncementController {
  constructor(private readonly service: AnnouncementService) {}

  @Post()
  @RequirePermissions(Permission.ANNOUNCEMENT_MANAGE)
  @ApiOperation({ summary: 'Publish an announcement (fans out to the audience as notifications)' })
  create(@Body() dto: CreateAnnouncementDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions(Permission.ANNOUNCEMENT_READ)
  list() {
    return this.service.list();
  }
}
