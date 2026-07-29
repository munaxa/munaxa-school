import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { TemplateRepository } from './template.repository';
import { UpsertTemplateDto } from './template.dto';

/** Admin-managed bilingual notification templates (tenant overrides of the built-in defaults). */
@ApiTags('notification-templates')
@ApiBearerAuth()
@Controller({ path: 'notifications/templates', version: '1' })
export class TemplateController {
  constructor(private readonly repo: TemplateRepository) {}

  @Get()
  @RequirePermissions(Permission.NOTIFICATION_SETTINGS)
  @ApiOperation({ summary: 'List this tenant’s notification templates' })
  list() {
    return this.repo.list();
  }

  @Put()
  @RequirePermissions(Permission.NOTIFICATION_SETTINGS)
  @ApiOperation({ summary: 'Create or update a template for (eventType, channel, language)' })
  upsert(@Body() dto: UpsertTemplateDto) {
    return this.repo.upsert(dto);
  }
}
