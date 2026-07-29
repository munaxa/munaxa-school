import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { GamificationService } from './gamification.service';
import { AwardAchievementDto, CreateAchievementDto } from './achievement.dto';

@ApiTags('student-app')
@ApiBearerAuth()
@Controller({ path: 'achievements', version: '1' })
export class AchievementController {
  constructor(private readonly service: GamificationService) {}

  @Post()
  @RequirePermissions(Permission.ACHIEVEMENT_MANAGE)
  @ApiOperation({ summary: 'Define an achievement/badge for the tenant' })
  create(@Body() dto: CreateAchievementDto) {
    return this.service.createAchievement(dto);
  }

  @Get()
  @RequirePermissions(Permission.ACHIEVEMENT_READ)
  @ApiOperation({ summary: 'List the tenant achievement catalog' })
  list() {
    return this.service.listAchievements();
  }

  @Post(':id/award')
  @HttpCode(200)
  @RequirePermissions(Permission.ACHIEVEMENT_MANAGE)
  @ApiOperation({ summary: 'Manually award an ACADEMIC/GENERAL achievement to a student' })
  award(@Param('id') id: string, @Body() dto: AwardAchievementDto) {
    return this.service.award(id, dto.studentId, dto.note);
  }
}
