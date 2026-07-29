import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { DriverService } from './driver.service';
import { CreateInfractionDto, UpdateInfractionDto, UpsertDriverProfileDto } from './driver.dto';

/** Fleet-facing driver directory: all driver employees + unassigned candidates. */
@ApiTags('drivers')
@ApiBearerAuth()
@Controller({ path: 'drivers', version: '1' })
export class DriverController {
  constructor(private readonly service: DriverService) {}

  @Get()
  @RequirePermissions(Permission.DRIVER_READ)
  list() {
    return this.service.listDrivers();
  }

  @Get('candidates')
  @RequirePermissions(Permission.DRIVER_MANAGE)
  candidates() {
    return this.service.listCandidates();
  }
}

/** Employee-scoped driver profile + infractions. */
@ApiTags('drivers')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId/driver-profile', version: '1' })
export class DriverProfileController {
  constructor(private readonly service: DriverService) {}

  @Get()
  @RequirePermissions(Permission.DRIVER_READ)
  get(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.getProfile(employeeId);
  }

  @Put()
  @RequirePermissions(Permission.DRIVER_MANAGE)
  upsert(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpsertDriverProfileDto,
  ) {
    return this.service.upsertProfile(employeeId, dto);
  }

  @Delete()
  @HttpCode(204)
  @RequirePermissions(Permission.DRIVER_MANAGE)
  remove(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.removeProfile(employeeId);
  }

  @Post('infractions')
  @RequirePermissions(Permission.DRIVER_MANAGE)
  addInfraction(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateInfractionDto,
  ) {
    return this.service.addInfraction(employeeId, dto);
  }

  @Patch('infractions/:id')
  @RequirePermissions(Permission.DRIVER_MANAGE)
  updateInfraction(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInfractionDto,
  ) {
    return this.service.updateInfraction(employeeId, id, dto);
  }

  @Delete('infractions/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.DRIVER_MANAGE)
  removeInfraction(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeInfraction(employeeId, id);
  }
}
