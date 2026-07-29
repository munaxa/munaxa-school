import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequireAnyPermission } from '../../auth/decorators/require-permissions.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('parent-portal')
@ApiBearerAuth()
@Controller({ path: 'parent', version: '1' })
@RequireAnyPermission(Permission.LEAVE_REQUEST, Permission.PTM_BOOK)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('children')
  @ApiOperation({ summary: 'Multi-child switcher: the children linked to the parent' })
  children() {
    return this.service.children();
  }

  @Get('dashboard')
  @ApiQuery({ name: 'studentId', required: true })
  @ApiOperation({ summary: 'Aggregated dashboard for one linked child' })
  dashboard(@Query('studentId') studentId: string) {
    return this.service.childDashboard(studentId);
  }

  @Get('timetable')
  @ApiQuery({ name: 'studentId', required: true })
  @ApiOperation({ summary: "A child's inherited weekly timetable" })
  timetable(@Query('studentId') studentId: string) {
    return this.service.childTimetable(studentId);
  }

  @Get('timetable/current')
  @ApiQuery({ name: 'studentId', required: true })
  @ApiOperation({ summary: "A child's live current/next class (Now Attending)" })
  currentClass(@Query('studentId') studentId: string) {
    return this.service.childCurrentClass(studentId);
  }

  @Get('finance/summary')
  @ApiOperation({
    summary: 'Family finance landing: outstanding, next installment, total paid, history, children',
  })
  familyFinance() {
    return this.service.familyFinance();
  }
}
