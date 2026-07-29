import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Bus, BusRoute, BusStop, StudentBusAssignment } from '@prisma/client';
import { BusRepository } from './bus.repository';
import type {
  AssignStudentDto,
  CreateBusDto,
  CreateBusRouteDto,
  CreateBusStopDto,
  UpdateBusDto,
  UpdateBusLocationDto,
  UpdateBusRouteDto,
} from './bus.dto';

@Injectable()
export class BusService {
  constructor(private readonly repo: BusRepository) {}

  createRoute(dto: CreateBusRouteDto): Promise<BusRoute> {
    return this.repo.createRoute({
      name: dto.name,
      description: dto.description ?? null,
      academicYearId: dto.academicYearId ?? null,
      round1Time: dto.round1Time ?? null,
      round2Time: dto.round2Time ?? null,
    });
  }

  async updateRoute(id: string, dto: UpdateBusRouteDto): Promise<BusRoute> {
    const route = await this.repo.findRoute(id);
    if (!route) throw new NotFoundException('Route not found');
    return this.repo.updateRoute(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.round1Time !== undefined ? { round1Time: dto.round1Time || null } : {}),
      ...(dto.round2Time !== undefined ? { round2Time: dto.round2Time || null } : {}),
      ...(dto.disabled !== undefined ? { disabledAt: dto.disabled ? new Date() : null } : {}),
      ...(dto.academicYearId !== undefined
        ? dto.academicYearId
          ? { academicYear: { connect: { id: dto.academicYearId } } }
          : { academicYear: { disconnect: true } }
        : {}),
    });
  }

  listRoutes(academicYearId?: string): Promise<BusRoute[]> {
    return this.repo.listRoutes(academicYearId);
  }

  async createBus(dto: CreateBusDto): Promise<Bus> {
    if (dto.routeId && !(await this.repo.routeExists(dto.routeId))) {
      throw new BadRequestException('Route not found in this tenant');
    }
    if (dto.driverId) await this.assertDriver(dto.driverId);
    return this.repo.createBus({
      plateNumber: dto.plateNumber,
      routeId: dto.routeId ?? null,
      label: dto.label ?? null,
      capacity: dto.capacity ?? null,
      tripRound: dto.tripRound ?? null,
      driverId: dto.driverId ?? null,
    });
  }

  async updateBus(id: string, dto: UpdateBusDto): Promise<Bus> {
    const bus = await this.repo.findBus(id);
    if (!bus) throw new NotFoundException('Bus not found');
    if (dto.routeId && !(await this.repo.routeExists(dto.routeId))) {
      throw new BadRequestException('Route not found in this tenant');
    }
    if (dto.driverId) await this.assertDriver(dto.driverId);
    return this.repo.updateBus(id, {
      ...(dto.plateNumber !== undefined ? { plateNumber: dto.plateNumber } : {}),
      ...(dto.routeId !== undefined
        ? dto.routeId
          ? { route: { connect: { id: dto.routeId } } }
          : { route: { disconnect: true } }
        : {}),
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      ...(dto.tripRound !== undefined ? { tripRound: dto.tripRound } : {}),
      ...(dto.driverId !== undefined
        ? dto.driverId
          ? { driver: { connect: { id: dto.driverId } } }
          : { driver: { disconnect: true } }
        : {}),
    });
  }

  /** A bus driver must be an Employee that has a driver profile. */
  private async assertDriver(driverId: string): Promise<void> {
    if (!(await this.repo.isDriver(driverId))) {
      throw new BadRequestException('The selected employee is not a registered driver');
    }
  }

  listBuses() {
    return this.repo.listBuses();
  }

  async updateLocation(id: string, dto: UpdateBusLocationDto): Promise<Bus> {
    const bus = await this.repo.findBus(id);
    if (!bus) throw new NotFoundException('Bus not found');
    return this.repo.updateLocation(id, dto.lat, dto.lng);
  }

  async createStop(dto: CreateBusStopDto): Promise<BusStop> {
    if (!(await this.repo.routeExists(dto.routeId))) {
      throw new BadRequestException('Route not found in this tenant');
    }
    if (dto.pickupTime && (await this.repo.pickupTimeTaken(dto.routeId, dto.pickupTime))) {
      throw new BadRequestException('Another stop on this route already uses that pickup time');
    }
    return this.repo.createStop({
      routeId: dto.routeId,
      name: dto.name,
      sequence: dto.sequence ?? 0,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      pickupTime: dto.pickupTime ?? null,
    });
  }

  listStops(routeId: string): Promise<BusStop[]> {
    return this.repo.listStops(routeId);
  }

  async assign(dto: AssignStudentDto): Promise<StudentBusAssignment> {
    if (!(await this.repo.routeExists(dto.routeId))) {
      throw new BadRequestException('Route not found in this tenant');
    }
    if (dto.stopId && !(await this.repo.stopBelongsToRoute(dto.stopId, dto.routeId))) {
      throw new BadRequestException('Stop does not belong to this route');
    }
    return this.repo.assign({
      studentId: dto.studentId,
      routeId: dto.routeId,
      stopId: dto.stopId ?? null,
      tripRound: dto.tripRound ?? null,
    });
  }

  async unassign(id: string): Promise<void> {
    const assignment = await this.repo.findAssignment(id);
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.repo.deleteAssignment(id);
  }

  listAssignments(routeId?: string): Promise<StudentBusAssignment[]> {
    return this.repo.listAssignments(routeId);
  }

  studentTransport(studentId: string) {
    return this.repo.studentTransport(studentId);
  }
}
