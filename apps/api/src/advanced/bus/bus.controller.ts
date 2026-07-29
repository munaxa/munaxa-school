import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../auth/decorators/require-permissions.decorator';
import { FeatureFlagGuard } from '../../feature-flags/feature-flag.guard';
import { FeatureFlagKey, RequireFeature } from '../../feature-flags/require-feature.decorator';
import { BusService } from './bus.service';
import {
  AssignStudentDto,
  CreateBusDto,
  CreateBusRouteDto,
  CreateBusStopDto,
  UpdateBusDto,
  UpdateBusLocationDto,
  UpdateBusRouteDto,
} from './bus.dto';

@ApiTags('bus-tracking')
@ApiBearerAuth()
@Controller({ path: 'bus', version: '1' })
@UseGuards(FeatureFlagGuard)
@RequireFeature(FeatureFlagKey.BUS_TRACKING)
export class BusController {
  constructor(private readonly service: BusService) {}

  @Post('routes')
  @RequirePermissions(Permission.BUS_MANAGE)
  @ApiOperation({ summary: 'Create a bus route' })
  createRoute(@Body() dto: CreateBusRouteDto) {
    return this.service.createRoute(dto);
  }

  @Get('routes')
  @RequirePermissions(Permission.BUS_READ)
  @ApiQuery({ name: 'academicYearId', required: false })
  listRoutes(@Query('academicYearId') academicYearId?: string) {
    return this.service.listRoutes(academicYearId);
  }

  @Patch('routes/:id')
  @RequirePermissions(Permission.BUS_MANAGE)
  @ApiOperation({ summary: 'Update a bus route' })
  updateRoute(@Param('id') id: string, @Body() dto: UpdateBusRouteDto) {
    return this.service.updateRoute(id, dto);
  }

  @Post('routes/stops')
  @RequirePermissions(Permission.BUS_MANAGE)
  @ApiOperation({ summary: 'Add a stop to a route' })
  createStop(@Body() dto: CreateBusStopDto) {
    return this.service.createStop(dto);
  }

  @Get('routes/:routeId/stops')
  @RequirePermissions(Permission.BUS_READ)
  listStops(@Param('routeId') routeId: string) {
    return this.service.listStops(routeId);
  }

  @Post('vehicles')
  @RequirePermissions(Permission.BUS_MANAGE)
  @ApiOperation({ summary: 'Register a bus' })
  createBus(@Body() dto: CreateBusDto) {
    return this.service.createBus(dto);
  }

  @Get('vehicles')
  @RequirePermissions(Permission.BUS_READ)
  @ApiOperation({ summary: 'List buses (with last known location)' })
  listBuses() {
    return this.service.listBuses();
  }

  @Patch('vehicles/:id')
  @RequirePermissions(Permission.BUS_MANAGE)
  @ApiOperation({ summary: 'Update a bus (plate, route, capacity, driver)' })
  updateBus(@Param('id') id: string, @Body() dto: UpdateBusDto) {
    return this.service.updateBus(id, dto);
  }

  @Post('vehicles/:id/location')
  @RequirePermissions(Permission.BUS_MANAGE)
  @ApiOperation({ summary: 'Push a live GPS location for a bus' })
  updateLocation(@Param('id') id: string, @Body() dto: UpdateBusLocationDto) {
    return this.service.updateLocation(id, dto);
  }

  @Post('assignments')
  // Either the narrow assignment permission or full fleet management grants this.
  @RequireAnyPermission(Permission.BUS_ASSIGN, Permission.BUS_MANAGE)
  @ApiOperation({ summary: 'Assign a student to a route/stop' })
  assign(@Body() dto: AssignStudentDto) {
    return this.service.assign(dto);
  }

  @Get('assignments')
  @RequirePermissions(Permission.BUS_READ)
  @ApiQuery({ name: 'routeId', required: false })
  listAssignments(@Query('routeId') routeId?: string) {
    return this.service.listAssignments(routeId);
  }

  @Delete('assignments/:id')
  @HttpCode(204)
  @RequireAnyPermission(Permission.BUS_ASSIGN, Permission.BUS_MANAGE)
  @ApiOperation({ summary: 'Unassign a student from their route' })
  unassign(@Param('id') id: string) {
    return this.service.unassign(id);
  }

  @Get('students/:studentId/transport')
  @RequirePermissions(Permission.BUS_READ)
  @ApiOperation({ summary: "A student's assigned route + bus" })
  studentTransport(@Param('studentId') studentId: string) {
    return this.service.studentTransport(studentId);
  }
}
