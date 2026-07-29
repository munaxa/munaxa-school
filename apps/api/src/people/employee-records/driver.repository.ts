import { Injectable } from '@nestjs/common';
import { EmploymentStatus, type DriverInfraction, type Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

const PROFILE_INCLUDE = {
  infractions: { orderBy: { date: 'desc' as const } },
  employee: {
    select: { id: true, firstNameEn: true, lastNameEn: true, personalPhone: true, status: true },
  },
} satisfies Prisma.DriverProfileInclude;

export type DriverProfileView = Prisma.DriverProfileGetPayload<{ include: typeof PROFILE_INCLUDE }>;

const INACTIVE_STATUSES: EmploymentStatus[] = [
  EmploymentStatus.RETIRED,
  EmploymentStatus.RESIGNED,
  EmploymentStatus.TERMINATED,
  EmploymentStatus.ARCHIVED,
];

@Injectable()
export class DriverRepository extends TenantRepository {
  employeeExists(employeeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.employee.findFirst({ where: { id: employeeId, deletedAt: null } })) !== null,
    );
  }

  findProfileByEmployee(employeeId: string): Promise<DriverProfileView | null> {
    return this.run((tx) =>
      tx.driverProfile.findFirst({
        where: { employeeId, deletedAt: null },
        include: PROFILE_INCLUDE,
      }),
    );
  }

  /** Create or update the employee's single driver profile, atomically + audited. */
  upsert(
    employeeId: string,
    data: Omit<Prisma.DriverProfileUncheckedCreateInput, 'tenantId' | 'employeeId'>,
  ): Promise<DriverProfileView> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.driverProfile.findFirst({
        where: { employeeId, deletedAt: null },
        select: { id: true },
      });
      const profile = existing
        ? await tx.driverProfile.update({
            where: { id: existing.id },
            data,
            include: PROFILE_INCLUDE,
          })
        : await tx.driverProfile.create({
            data: { ...data, tenantId, employeeId },
            include: PROFILE_INCLUDE,
          });
      await this.writeAudit(tx, tenantId, {
        action: existing ? 'driver_profile.update' : 'driver_profile.create',
        entityType: 'DriverProfile',
        entityId: profile.id,
        metadata: { employeeId },
      });
      return profile;
    });
  }

  softDeleteProfile(id: string): Promise<unknown> {
    return this.run(async (tx, tenantId) => {
      const profile = await tx.driverProfile.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'driver_profile.delete',
        entityType: 'DriverProfile',
        entityId: id,
      });
      return profile;
    });
  }

  /** List all driver employees (with profile, phone, and their currently assigned buses). */
  listDrivers(): Promise<
    Array<
      DriverProfileView & {
        buses: Array<{ id: string; plateNumber: string; label: string | null }>;
      }
    >
  > {
    return this.run(async (tx) => {
      const profiles = await tx.driverProfile.findMany({
        where: { deletedAt: null, employee: { deletedAt: null } },
        include: PROFILE_INCLUDE,
        orderBy: { employee: { lastNameEn: 'asc' } },
      });
      const buses = await tx.bus.findMany({
        where: { deletedAt: null, driverId: { not: null } },
        select: { id: true, plateNumber: true, label: true, driverId: true },
      });
      const byDriver = new Map<
        string,
        Array<{ id: string; plateNumber: string; label: string | null }>
      >();
      for (const b of buses) {
        if (!b.driverId) continue;
        const list = byDriver.get(b.driverId) ?? [];
        list.push({ id: b.id, plateNumber: b.plateNumber, label: b.label });
        byDriver.set(b.driverId, list);
      }
      return profiles.map((p) => ({ ...p, buses: byDriver.get(p.employeeId) ?? [] }));
    });
  }

  /** Active employees who are NOT yet drivers — candidates to assign a driver profile. */
  listDriverCandidates(): Promise<
    Array<{ id: string; firstNameEn: string; lastNameEn: string; personalPhone: string | null }>
  > {
    return this.run((tx) =>
      tx.employee.findMany({
        where: {
          deletedAt: null,
          status: { notIn: INACTIVE_STATUSES },
          driverProfile: { is: null },
        },
        select: { id: true, firstNameEn: true, lastNameEn: true, personalPhone: true },
        orderBy: [{ lastNameEn: 'asc' }, { firstNameEn: 'asc' }],
      }),
    );
  }

  // ----- Infractions --------------------------------------------------------
  createInfraction(
    driverProfileId: string,
    data: Omit<Prisma.DriverInfractionUncheckedCreateInput, 'tenantId' | 'driverProfileId'>,
  ): Promise<DriverInfraction> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.driverInfraction.create({
        data: { ...data, tenantId, driverProfileId },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'driver_infraction.create',
        entityType: 'DriverInfraction',
        entityId: row.id,
        metadata: { driverProfileId },
      });
      return row;
    });
  }

  findInfraction(id: string): Promise<DriverInfraction | null> {
    return this.run((tx) => tx.driverInfraction.findFirst({ where: { id } }));
  }

  updateInfraction(
    id: string,
    data: Prisma.DriverInfractionUncheckedUpdateInput,
  ): Promise<DriverInfraction> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.driverInfraction.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'driver_infraction.update',
        entityType: 'DriverInfraction',
        entityId: id,
      });
      return row;
    });
  }

  deleteInfraction(id: string): Promise<DriverInfraction> {
    return this.run(async (tx, tenantId) => {
      await this.writeAudit(tx, tenantId, {
        action: 'driver_infraction.delete',
        entityType: 'DriverInfraction',
        entityId: id,
      });
      return tx.driverInfraction.delete({ where: { id } });
    });
  }
}
