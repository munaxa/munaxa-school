import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { EnrollmentService } from './enrollment.service';
import { QuoteDto } from './enrollment.dto';

/**
 * Enrollment (Phase 2). The quote endpoint computes registration + tuition + transport − discount
 * and an installment schedule from the configuration layer (read-only). The actual charge creation
 * is performed by the existing finance endpoints once the registrar confirms the quote.
 */
@ApiTags('finance')
@ApiBearerAuth()
@Controller({ path: 'enrollment', version: '1' })
export class EnrollmentController {
  constructor(private readonly service: EnrollmentService) {}

  @Post('quote')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'Compute an enrollment fee quote + installment schedule (no writes)' })
  quote(@Body() dto: QuoteDto) {
    return this.service.quote(dto);
  }
}
