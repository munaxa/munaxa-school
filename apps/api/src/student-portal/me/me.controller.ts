import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequireAnyPermission } from '../../auth/decorators/require-permissions.decorator';
import { MeService } from './me.service';

/**
 * The student app self-service surface: every endpoint resolves the signed-in student from
 * `Student.userId` and returns only their own data. Gated by student read permissions.
 */
@ApiTags('student-app')
@ApiBearerAuth()
@Controller({ path: 'me', version: '1' })
@RequireAnyPermission(
  Permission.HOMEWORK_READ,
  Permission.ATTENDANCE_READ,
  Permission.TIMETABLE_READ,
  Permission.GAMIFICATION_READ,
)
export class MeController {
  constructor(private readonly service: MeService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Student dashboard (attendance, homework, grades, gamification)' })
  dashboard() {
    return this.service.dashboard();
  }

  @Get('homework')
  @ApiOperation({ summary: "The student's homework list" })
  homework() {
    return this.service.homework();
  }

  @Get('attendance')
  @ApiOperation({ summary: "The student's attendance history" })
  attendance() {
    return this.service.attendance();
  }

  @Get('timetable')
  @ApiOperation({ summary: "The student's weekly timetable (inherited from their section)" })
  timetable() {
    return this.service.timetable();
  }

  @Get('timetable/current')
  @ApiOperation({ summary: "The student's live current/next class" })
  currentClass() {
    return this.service.liveClass();
  }

  @Get('resources')
  @ApiOperation({ summary: 'Resource library visible to the student' })
  resources() {
    return this.service.resourceLibrary();
  }

  @Get('gamification')
  @ApiOperation({ summary: 'Points, level, attendance streaks (recomputed)' })
  gamification() {
    return this.service.gamificationSummary();
  }

  @Get('achievements')
  @ApiOperation({ summary: 'Earned achievements/badges' })
  achievements() {
    return this.service.achievements();
  }
}
