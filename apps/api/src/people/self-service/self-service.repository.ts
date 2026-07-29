import { Injectable } from '@nestjs/common';
import { StaffLeaveStatus, type Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

const PROFILE_SELECT = {
  id: true,
  firstNameEn: true,
  lastNameEn: true,
  firstNameAr: true,
  lastNameAr: true,
  employeeNumber: true,
  jobTitle: true,
  employmentType: true,
  status: true,
  hireDate: true,
  personalEmail: true,
  personalPhone: true,
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  manager: { select: { id: true, firstNameEn: true, lastNameEn: true } },
} satisfies Prisma.EmployeeSelect;

const REPORT_SELECT = {
  id: true,
  firstNameEn: true,
  lastNameEn: true,
  jobTitle: true,
  status: true,
  department: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeSelect;

const TEAM_REQUEST_INCLUDE = {
  leaveType: { select: { id: true, name: true, paid: true } },
  employee: { select: { id: true, firstNameEn: true, lastNameEn: true } },
} satisfies Prisma.StaffLeaveRequestInclude;

export type MyProfile = Prisma.EmployeeGetPayload<{ select: typeof PROFILE_SELECT }>;
export type ReportRow = Prisma.EmployeeGetPayload<{ select: typeof REPORT_SELECT }>;
export type TeamRequest = Prisma.StaffLeaveRequestGetPayload<{
  include: typeof TEAM_REQUEST_INCLUDE;
}>;

@Injectable()
export class SelfServiceRepository extends TenantRepository {
  /** The employee record linked to a user account, or null when the user isn't an employee. */
  employeeIdForUser(userId: string): Promise<string | null> {
    return this.run(async (tx) => {
      const e = await tx.employee.findFirst({
        where: { userId, deletedAt: null },
        select: { id: true },
      });
      return e?.id ?? null;
    });
  }

  myProfile(employeeId: string): Promise<MyProfile | null> {
    return this.run((tx) =>
      tx.employee.findFirst({ where: { id: employeeId }, select: PROFILE_SELECT }),
    );
  }

  /** Direct reports of a manager (employees whose managerId is the manager's employee id). */
  reports(managerEmployeeId: string): Promise<ReportRow[]> {
    return this.run((tx) =>
      tx.employee.findMany({
        where: { managerId: managerEmployeeId, deletedAt: null },
        select: REPORT_SELECT,
        orderBy: [{ lastNameEn: 'asc' }, { firstNameEn: 'asc' }],
      }),
    );
  }

  /** True when `employeeId` reports directly to `managerEmployeeId`. */
  isReport(managerEmployeeId: string, employeeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.employee.findFirst({
          where: { id: employeeId, managerId: managerEmployeeId },
          select: { id: true },
        })) !== null,
    );
  }

  /** Pending leave requests submitted by a manager's direct reports. */
  teamPendingLeave(managerEmployeeId: string): Promise<TeamRequest[]> {
    return this.run((tx) =>
      tx.staffLeaveRequest.findMany({
        where: {
          status: StaffLeaveStatus.PENDING,
          employee: { managerId: managerEmployeeId },
        },
        include: TEAM_REQUEST_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /** The employee who owns a leave request (to authorise a manager decision). */
  leaveRequestOwner(requestId: string): Promise<string | null> {
    return this.run(async (tx) => {
      const r = await tx.staffLeaveRequest.findFirst({
        where: { id: requestId },
        select: { employeeId: true },
      });
      return r?.employeeId ?? null;
    });
  }
}
