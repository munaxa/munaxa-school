import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BookLoanStatus } from '@prisma/client';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { FeatureFlagGuard } from '../../feature-flags/feature-flag.guard';
import { FeatureFlagKey, RequireFeature } from '../../feature-flags/require-feature.decorator';
import { LibraryService } from './library.service';
import { CheckoutBookDto, CreateBookDto } from './library.dto';

@ApiTags('library')
@ApiBearerAuth()
@Controller({ path: 'library', version: '1' })
@UseGuards(FeatureFlagGuard)
@RequireFeature(FeatureFlagKey.LIBRARY_MANAGEMENT)
export class LibraryController {
  constructor(private readonly service: LibraryService) {}

  @Post('books')
  @RequirePermissions(Permission.LIBRARY_MANAGE)
  @ApiOperation({ summary: 'Catalogue a book' })
  createBook(@Body() dto: CreateBookDto) {
    return this.service.createBook(dto);
  }

  @Get('books')
  @RequirePermissions(Permission.LIBRARY_READ)
  listBooks() {
    return this.service.listBooks();
  }

  @Post('loans')
  @RequirePermissions(Permission.LIBRARY_MANAGE)
  @ApiOperation({ summary: 'Check a book out (decrements availability)' })
  checkout(@Body() dto: CheckoutBookDto) {
    return this.service.checkout(dto);
  }

  @Post('loans/:id/return')
  @HttpCode(200)
  @RequirePermissions(Permission.LIBRARY_MANAGE)
  @ApiOperation({ summary: 'Return a loaned book (restores availability)' })
  returnLoan(@Param('id') id: string) {
    return this.service.returnLoan(id);
  }

  @Get('loans')
  @RequirePermissions(Permission.LIBRARY_READ)
  @ApiQuery({ name: 'status', required: false, enum: BookLoanStatus })
  listLoans(@Query('status') status?: BookLoanStatus) {
    return this.service.listLoans(status);
  }
}
