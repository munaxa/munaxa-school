import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { StatementService } from './statement.service';

@ApiTags('finance')
@ApiBearerAuth()
@Controller({ path: 'finance/students', version: '1' })
export class StatementController {
  constructor(private readonly service: StatementService) {}

  @Get(':studentId/statement')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'Student financial statement + outstanding balance' })
  statement(@Param('studentId') studentId: string) {
    return this.service.forStudent(studentId);
  }

  @Get(':studentId/household')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'Siblings (shared-guardian students) with their outstanding balances' })
  household(@Param('studentId') studentId: string) {
    return this.service.household(studentId);
  }

  @Get('by-parent/:parentId')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({
    summary: "A guardian's students with grade, transport demand and outstanding balances",
  })
  byParent(@Param('parentId') parentId: string) {
    return this.service.parentStudents(parentId);
  }
}
