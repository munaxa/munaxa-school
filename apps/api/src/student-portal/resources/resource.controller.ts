import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ResourceService } from './resource.service';
import { CreateResourceDto, PresignResourceDto } from './resource.dto';

@ApiTags('student-app')
@ApiBearerAuth()
@Controller({ path: 'resources', version: '1' })
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  @Post('presign')
  @HttpCode(200)
  @RequirePermissions(Permission.RESOURCE_MANAGE)
  @ApiOperation({ summary: 'Pre-signed S3 URL to upload a FILE/DOCUMENT resource' })
  presign(@Body() dto: PresignResourceDto) {
    return this.service.presign(dto);
  }

  @Post()
  @RequirePermissions(Permission.RESOURCE_MANAGE)
  @ApiOperation({ summary: 'Publish a learning resource (section / grade / whole-school scope)' })
  create(@Body() dto: CreateResourceDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions(Permission.RESOURCE_MANAGE)
  @ApiOperation({ summary: 'List all resources (staff)' })
  list() {
    return this.service.list();
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.RESOURCE_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
