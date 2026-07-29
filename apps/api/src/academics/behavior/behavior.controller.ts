import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { BehaviorService } from './behavior.service';
import { CreateBehaviorDto } from './behavior.dto';

@ApiTags('behavior')
@ApiBearerAuth()
@Controller({ path: 'behavior', version: '1' })
export class BehaviorController {
  constructor(private readonly service: BehaviorService) {}

  @Post()
  @RequirePermissions(Permission.BEHAVIOR_MANAGE)
  create(@Body() dto: CreateBehaviorDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions(Permission.BEHAVIOR_READ)
  @ApiQuery({ name: 'studentId', required: true })
  list(@Query('studentId') studentId: string) {
    return this.service.listForStudent(studentId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.BEHAVIOR_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
