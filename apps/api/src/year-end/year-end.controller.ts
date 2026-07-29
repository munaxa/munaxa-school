import { Body, Controller, Get, Param, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { YearEndProcessingService } from './year-end.service';
import { OpenYearEndDto, SetDecisionDto } from './year-end.dto';

/**
 * Year-End Processing (Decisions 9 & 10). Administrative workflow: open a run + review board, draft
 * per-student decisions (preview — nothing created), then Final Confirm to promote/repeat/graduate/
 * withdraw. Gated on academic-year management (SchoolAdmin/Principal/Registrar).
 */
@ApiTags('year-end')
@ApiBearerAuth()
@Controller({ path: 'year-end', version: '1' })
export class YearEndController {
  constructor(private readonly service: YearEndProcessingService) {}

  @Post('processes')
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  @ApiOperation({
    summary: 'Open a year-end run and build the review board (creates no enrollments)',
  })
  open(@Body() dto: OpenYearEndDto) {
    return this.service.open(dto);
  }

  @Get('processes/:id')
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  @ApiOperation({ summary: 'Review board: the process + every per-student decision' })
  review(@Param('id') id: string) {
    return this.service.review(id);
  }

  @Patch('decisions/:id')
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  @ApiOperation({
    summary: 'Draft a per-student decision (preview — no enrollment/finance created)',
  })
  setDecision(@Param('id') id: string, @Body() dto: SetDecisionDto) {
    return this.service.setDecision(id, dto);
  }

  @Post('processes/:id/commit')
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  @ApiOperation({
    summary: 'Final Confirm — apply every decision via the shared pipeline / lifecycle',
  })
  commit(@Param('id') id: string) {
    return this.service.commit(id);
  }

  @Post('processes/:id/cancel')
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  @ApiOperation({ summary: 'Discard a draft run before commit (reversible until Final Confirm)' })
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
