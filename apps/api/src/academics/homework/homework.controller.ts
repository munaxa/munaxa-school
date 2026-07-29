import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { HomeworkService } from './homework.service';
import {
  ConfirmAttachmentDto,
  CreateHomeworkDto,
  PresignAttachmentDto,
  UpdateHomeworkDto,
} from './homework.dto';

@ApiTags('homework')
@ApiBearerAuth()
@Controller({ path: 'homework', version: '1' })
export class HomeworkController {
  constructor(private readonly service: HomeworkService) {}

  @Post()
  @RequirePermissions(Permission.HOMEWORK_MANAGE)
  create(@Body() dto: CreateHomeworkDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions(Permission.HOMEWORK_READ)
  @ApiQuery({ name: 'sectionId', required: true })
  list(@Query('sectionId') sectionId: string) {
    return this.service.listBySection(sectionId);
  }

  @Get(':id')
  @RequirePermissions(Permission.HOMEWORK_READ)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.HOMEWORK_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateHomeworkDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.HOMEWORK_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ----- Attachments -------------------------------------------------------
  @Post(':id/attachments/presign')
  @HttpCode(200)
  @RequirePermissions(Permission.HOMEWORK_MANAGE)
  @ApiOperation({ summary: 'Get a pre-signed S3 URL to upload an attachment' })
  presign(@Param('id') id: string, @Body() dto: PresignAttachmentDto) {
    return this.service.presignAttachment(id, dto);
  }

  @Post(':id/attachments')
  @RequirePermissions(Permission.HOMEWORK_MANAGE)
  @ApiOperation({ summary: 'Confirm an uploaded attachment (store metadata)' })
  confirm(@Param('id') id: string, @Body() dto: ConfirmAttachmentDto) {
    return this.service.confirmAttachment(id, dto);
  }

  @Get(':id/attachments')
  @RequirePermissions(Permission.HOMEWORK_READ)
  listAttachments(@Param('id') id: string) {
    return this.service.listAttachments(id);
  }
}
