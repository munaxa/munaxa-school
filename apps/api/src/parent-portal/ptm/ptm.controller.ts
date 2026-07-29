import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../auth/decorators/require-permissions.decorator';
import { PtmService } from './ptm.service';
import { CreatePtmBookingDto, CreatePtmSlotDto } from './ptm.dto';

@ApiTags('parent-portal')
@ApiBearerAuth()
@Controller({ path: 'ptm', version: '1' })
export class PtmController {
  constructor(private readonly service: PtmService) {}

  @Post('slots')
  @RequirePermissions(Permission.PTM_MANAGE)
  @ApiOperation({ summary: 'Staff opens a Parent-Teacher Meeting slot' })
  createSlot(@Body() dto: CreatePtmSlotDto) {
    return this.service.createSlot(dto);
  }

  @Get('slots')
  @RequireAnyPermission(Permission.PTM_MANAGE, Permission.PTM_BOOK)
  @ApiQuery({ name: 'teacherId', required: false })
  @ApiQuery({ name: 'open', required: false, type: Boolean })
  @ApiOperation({ summary: 'List PTM slots (parents browse open slots to book)' })
  listSlots(@Query('teacherId') teacherId?: string, @Query('open') open?: string) {
    return this.service.listSlots(teacherId, open === 'true');
  }

  @Post('bookings')
  @RequirePermissions(Permission.PTM_BOOK)
  @ApiOperation({ summary: 'Parent books a PTM slot for a linked child' })
  book(@Body() dto: CreatePtmBookingDto) {
    return this.service.book(dto);
  }

  @Get('bookings')
  @RequireAnyPermission(Permission.PTM_MANAGE, Permission.PTM_BOOK)
  @ApiOperation({ summary: 'List bookings (parents see their children; staff see all)' })
  listBookings() {
    return this.service.listBookings();
  }

  @Delete('bookings/:id')
  @HttpCode(200)
  @RequireAnyPermission(Permission.PTM_MANAGE, Permission.PTM_BOOK)
  @ApiOperation({ summary: 'Cancel a booking (re-opens the slot)' })
  cancelBooking(@Param('id') id: string) {
    return this.service.cancelBooking(id);
  }
}
