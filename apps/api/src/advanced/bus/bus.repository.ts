import { Injectable } from '@nestjs/common';
import type { Bus, BusRoute, BusStop, Prisma, StudentBusAssignment } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

/** Driver (Employee) fields surfaced with each bus so the UI can show name + phone. */
const BUS_DRIVER_INCLUDE = {
  driver: { select: { id: true, firstNameEn: true, lastNameEn: true, personalPhone: true } },
} satisfies Prisma.BusInclude;

export type BusWithDriver = Prisma.BusGetPayload<{ include: typeof BUS_DRIVER_INCLUDE }>;

@Injectable()
export class BusRepository extends TenantRepository {
  createRoute(data: Omit<Prisma.BusRouteUncheckedCreateInput, 'tenantId'>): Promise<BusRoute> {
    return this.run((tx, tenantId) => tx.busRoute.create({ data: { ...data, tenantId } }));
  }

  updateRoute(id: string, data: Prisma.BusRouteUpdateInput): Promise<BusRoute> {
    return this.run((tx) => tx.busRoute.update({ where: { id }, data }));
  }

  findRoute(id: string): Promise<BusRoute | null> {
    return this.run((tx) => tx.busRoute.findFirst({ where: { id, deletedAt: null } }));
  }

  listRoutes(academicYearId?: string): Promise<BusRoute[]> {
    return this.run((tx) =>
      tx.busRoute.findMany({
        where: { deletedAt: null, ...(academicYearId ? { academicYearId } : {}) },
        orderBy: { name: 'asc' },
      }),
    );
  }

  createBus(data: Omit<Prisma.BusUncheckedCreateInput, 'tenantId'>): Promise<Bus> {
    return this.run((tx, tenantId) => tx.bus.create({ data: { ...data, tenantId } }));
  }

  updateBus(id: string, data: Prisma.BusUpdateInput): Promise<Bus> {
    return this.run((tx) => tx.bus.update({ where: { id }, data }));
  }

  listBuses(): Promise<BusWithDriver[]> {
    return this.run((tx) =>
      tx.bus.findMany({
        where: { deletedAt: null },
        include: BUS_DRIVER_INCLUDE,
        orderBy: { plateNumber: 'asc' },
      }),
    );
  }

  findBus(id: string): Promise<Bus | null> {
    return this.run((tx) => tx.bus.findFirst({ where: { id, deletedAt: null } }));
  }

  /** True when `employeeId` is an Employee holding a (non-deleted) driver profile. */
  isDriver(employeeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.employee.findFirst({
          where: { id: employeeId, deletedAt: null, driverProfile: { deletedAt: null } },
          select: { id: true },
        })) !== null,
    );
  }

  updateLocation(id: string, lat: number, lng: number): Promise<Bus> {
    return this.run((tx) =>
      tx.bus.update({
        where: { id },
        data: { lastLat: lat, lastLng: lng, lastSeenAt: new Date() },
      }),
    );
  }

  createStop(data: Omit<Prisma.BusStopUncheckedCreateInput, 'tenantId'>): Promise<BusStop> {
    return this.run((tx, tenantId) => tx.busStop.create({ data: { ...data, tenantId } }));
  }

  listStops(routeId: string): Promise<BusStop[]> {
    return this.run((tx) =>
      tx.busStop.findMany({ where: { routeId }, orderBy: { sequence: 'asc' } }),
    );
  }

  /** Whether another stop on the same route already uses this pickup time. */
  pickupTimeTaken(routeId: string, pickupTime: string): Promise<boolean> {
    return this.run(
      async (tx) => (await tx.busStop.findFirst({ where: { routeId, pickupTime } })) !== null,
    );
  }

  /** Whether the stop exists and belongs to the given route. */
  stopBelongsToRoute(stopId: string, routeId: string): Promise<boolean> {
    return this.run(
      async (tx) => (await tx.busStop.findFirst({ where: { id: stopId, routeId } })) !== null,
    );
  }

  routeExists(routeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.busRoute.findFirst({ where: { id: routeId, deletedAt: null } })) !== null,
    );
  }

  assign(data: {
    studentId: string;
    routeId: string;
    stopId: string | null;
    tripRound: number | null;
  }): Promise<StudentBusAssignment> {
    return this.run(async (tx, tenantId) => {
      // One assignment per student: reassigning moves them (route + stop + trip) rather than adding a row.
      const existing = await tx.studentBusAssignment.findFirst({
        where: { studentId: data.studentId },
      });
      if (existing) {
        return tx.studentBusAssignment.update({
          where: { id: existing.id },
          data: { routeId: data.routeId, stopId: data.stopId, tripRound: data.tripRound },
        });
      }
      return tx.studentBusAssignment.create({ data: { ...data, tenantId } });
    });
  }

  findAssignment(id: string): Promise<StudentBusAssignment | null> {
    return this.run((tx) => tx.studentBusAssignment.findFirst({ where: { id } }));
  }

  deleteAssignment(id: string): Promise<StudentBusAssignment> {
    return this.run((tx) => tx.studentBusAssignment.delete({ where: { id } }));
  }

  listAssignments(routeId?: string): Promise<StudentBusAssignment[]> {
    return this.run((tx) =>
      tx.studentBusAssignment.findMany({
        where: { ...(routeId ? { routeId } : {}) },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /** A student's current route + trip + the bus serving it (for the student profile). */
  studentTransport(studentId: string): Promise<{
    routeName: string;
    tripRound: number | null;
    busNumber: string | null;
    busPlate: string | null;
  } | null> {
    return this.run(async (tx) => {
      const a = await tx.studentBusAssignment.findFirst({
        where: { studentId },
        include: { route: { select: { id: true, name: true } } },
      });
      if (!a?.route) return null;
      const bus = await tx.bus.findFirst({
        where: { routeId: a.route.id, deletedAt: null },
        select: { plateNumber: true, label: true },
      });
      return {
        routeName: a.route.name,
        tripRound: a.tripRound,
        busNumber: bus?.label ?? null,
        busPlate: bus?.plateNumber ?? null,
      };
    });
  }
}
