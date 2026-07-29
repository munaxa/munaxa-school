import { Injectable } from '@nestjs/common';
import {
  ApplicantStatus,
  AssetStatus,
  EmploymentStatus,
  JobPostingStatus,
  PerformanceCycleStatus,
  PerformanceReviewStatus,
  StaffLeaveStatus,
} from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

export interface StatusCount {
  status: EmploymentStatus;
  count: number;
}
export interface DepartmentCount {
  departmentId: string | null;
  name: string;
  count: number;
}

/** A single expiring/actionable item surfaced on the dashboard and by the alerts feed. */
export interface ExpiringItem {
  type: 'document' | 'contract' | 'certificate' | 'training' | 'probation';
  entityId: string;
  employeeId: string;
  employeeName: string;
  label: string;
  dueDate: string; // ISO date
}

export interface RosterRow {
  employeeNumber: string | null;
  firstNameEn: string;
  lastNameEn: string;
  jobTitle: string;
  department: { name: string } | null;
  status: EmploymentStatus;
  hireDate: Date | null;
}

const ACTIVE_APPLICANT_STATUSES: ApplicantStatus[] = [
  ApplicantStatus.APPLIED,
  ApplicantStatus.SCREENING,
  ApplicantStatus.INTERVIEW,
  ApplicantStatus.OFFER,
];

@Injectable()
export class HrDashboardRepository extends TenantRepository {
  headcountByStatus(): Promise<StatusCount[]> {
    return this.run(async (tx) => {
      const rows = await tx.employee.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      });
      return rows.map((r) => ({ status: r.status, count: r._count._all }));
    });
  }

  headcountByDepartment(): Promise<DepartmentCount[]> {
    return this.run(async (tx) => {
      const rows = await tx.employee.groupBy({
        by: ['departmentId'],
        where: { deletedAt: null },
        _count: { _all: true },
      });
      const ids = rows.map((r) => r.departmentId).filter((id): id is string => id !== null);
      const depts = ids.length
        ? await tx.department.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          })
        : [];
      const nameById = new Map(depts.map((d) => [d.id, d.name]));
      return rows
        .map((r) => ({
          departmentId: r.departmentId,
          name: r.departmentId ? (nameById.get(r.departmentId) ?? '—') : 'Unassigned',
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count);
    });
  }

  counts(): Promise<{
    pendingLeave: number;
    openPostings: number;
    activeApplicants: number;
    assetsTotal: number;
    assetsAssigned: number;
    assetsAvailable: number;
    activeCycles: number;
    reviewsAwaitingAck: number;
  }> {
    return this.run(async (tx) => {
      const [
        pendingLeave,
        openPostings,
        activeApplicants,
        assetsTotal,
        assetsAssigned,
        assetsAvailable,
        activeCycles,
        reviewsAwaitingAck,
      ] = await Promise.all([
        tx.staffLeaveRequest.count({ where: { status: StaffLeaveStatus.PENDING } }),
        tx.jobPosting.count({ where: { deletedAt: null, status: JobPostingStatus.OPEN } }),
        tx.jobApplicant.count({ where: { status: { in: ACTIVE_APPLICANT_STATUSES } } }),
        tx.asset.count({ where: { deletedAt: null } }),
        tx.asset.count({ where: { deletedAt: null, status: AssetStatus.ASSIGNED } }),
        tx.asset.count({ where: { deletedAt: null, status: AssetStatus.AVAILABLE } }),
        tx.performanceCycle.count({
          where: { deletedAt: null, status: PerformanceCycleStatus.ACTIVE },
        }),
        tx.performanceReview.count({ where: { status: PerformanceReviewStatus.SUBMITTED } }),
      ]);
      return {
        pendingLeave,
        openPostings,
        activeApplicants,
        assetsTotal,
        assetsAssigned,
        assetsAvailable,
        activeCycles,
        reviewsAwaitingAck,
      };
    });
  }

  /** All expiring/actionable items on or before `cutoff` (overdue included), for the alerts feed. */
  expiringItems(cutoff: Date): Promise<ExpiringItem[]> {
    const name = (e: { firstNameEn: string; lastNameEn: string }) =>
      `${e.firstNameEn} ${e.lastNameEn}`;
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const empSel = { select: { id: true, firstNameEn: true, lastNameEn: true } };
    return this.run(async (tx) => {
      const [docs, contracts, certs, training, probation] = await Promise.all([
        tx.employeeDocument.findMany({
          where: { deletedAt: null, expiryDate: { not: null, lte: cutoff } },
          select: { id: true, title: true, expiryDate: true, employee: empSel },
          orderBy: { expiryDate: 'asc' },
          take: 100,
        }),
        tx.employmentContract.findMany({
          where: { endDate: { not: null, lte: cutoff } },
          select: { id: true, endDate: true, employee: empSel },
          orderBy: { endDate: 'asc' },
          take: 100,
        }),
        tx.certificate.findMany({
          where: { expiryDate: { not: null, lte: cutoff } },
          select: { id: true, name: true, expiryDate: true, employee: empSel },
          orderBy: { expiryDate: 'asc' },
          take: 100,
        }),
        tx.trainingRecord.findMany({
          where: { expiresAt: { not: null, lte: cutoff } },
          select: {
            id: true,
            expiresAt: true,
            course: { select: { title: true } },
            employee: empSel,
          },
          orderBy: { expiresAt: 'asc' },
          take: 100,
        }),
        tx.employee.findMany({
          where: {
            deletedAt: null,
            status: EmploymentStatus.PROBATION,
            probationEndDate: { not: null, lte: cutoff },
          },
          select: { id: true, firstNameEn: true, lastNameEn: true, probationEndDate: true },
          orderBy: { probationEndDate: 'asc' },
          take: 100,
        }),
      ]);

      const items: ExpiringItem[] = [];
      for (const d of docs) {
        items.push({
          type: 'document',
          entityId: d.id,
          employeeId: d.employee.id,
          employeeName: name(d.employee),
          label: d.title,
          dueDate: iso(d.expiryDate!),
        });
      }
      for (const c of contracts) {
        items.push({
          type: 'contract',
          entityId: c.id,
          employeeId: c.employee.id,
          employeeName: name(c.employee),
          label: 'Contract end',
          dueDate: iso(c.endDate!),
        });
      }
      for (const c of certs) {
        items.push({
          type: 'certificate',
          entityId: c.id,
          employeeId: c.employee.id,
          employeeName: name(c.employee),
          label: c.name,
          dueDate: iso(c.expiryDate!),
        });
      }
      for (const r of training) {
        items.push({
          type: 'training',
          entityId: r.id,
          employeeId: r.employee.id,
          employeeName: name(r.employee),
          label: r.course.title,
          dueDate: iso(r.expiresAt!),
        });
      }
      for (const e of probation) {
        items.push({
          type: 'probation',
          entityId: e.id,
          employeeId: e.id,
          employeeName: name(e),
          label: 'Probation ends',
          dueDate: iso(e.probationEndDate!),
        });
      }
      return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    });
  }

  roster(): Promise<RosterRow[]> {
    return this.run(
      (tx) =>
        tx.employee.findMany({
          where: { deletedAt: null },
          select: {
            employeeNumber: true,
            firstNameEn: true,
            lastNameEn: true,
            jobTitle: true,
            status: true,
            hireDate: true,
            department: { select: { name: true } },
          },
          orderBy: [{ lastNameEn: 'asc' }, { firstNameEn: 'asc' }],
        }) as Promise<RosterRow[]>,
    );
  }
}
