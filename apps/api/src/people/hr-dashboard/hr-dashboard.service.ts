import { Injectable } from '@nestjs/common';
import { HrDashboardRepository, type ExpiringItem } from './hr-dashboard.repository';
import type { ReportTable } from '../../reporting/export/report.types';

/** Days ahead within which an expiring item is surfaced on the dashboard summary. */
const DASHBOARD_WINDOW_DAYS = 60;

export interface HrAlert extends ExpiringItem {
  severity: 'overdue' | 'due_soon';
  daysRemaining: number;
}

@Injectable()
export class HrDashboardService {
  constructor(private readonly repo: HrDashboardRepository) {}

  async dashboard() {
    const cutoff = this.cutoff(DASHBOARD_WINDOW_DAYS);
    const [byStatus, byDepartment, counts, expiring] = await Promise.all([
      this.repo.headcountByStatus(),
      this.repo.headcountByDepartment(),
      this.repo.counts(),
      this.repo.expiringItems(cutoff),
    ]);
    const total = byStatus.reduce((sum, s) => sum + s.count, 0);
    const expiringByType = expiring.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1;
      return acc;
    }, {});

    return {
      generatedAt: new Date().toISOString(),
      windowDays: DASHBOARD_WINDOW_DAYS,
      headcount: { total, byStatus, byDepartment: byDepartment.slice(0, 10) },
      leave: { pendingApprovals: counts.pendingLeave },
      recruitment: { openPostings: counts.openPostings, activeApplicants: counts.activeApplicants },
      assets: {
        total: counts.assetsTotal,
        assigned: counts.assetsAssigned,
        available: counts.assetsAvailable,
      },
      performance: {
        activeCycles: counts.activeCycles,
        reviewsAwaitingAck: counts.reviewsAwaitingAck,
      },
      expiring: {
        documents: expiringByType.document ?? 0,
        contracts: expiringByType.contract ?? 0,
        certificates: expiringByType.certificate ?? 0,
        training: expiringByType.training ?? 0,
        probation: expiringByType.probation ?? 0,
      },
    };
  }

  /**
   * The actionable HR alerts feed (also the automation/notification source of truth: a scheduled job
   * would consume this same query to dispatch reminders). `within` bounds the look-ahead window.
   */
  async alerts(within: number): Promise<HrAlert[]> {
    const items = await this.repo.expiringItems(this.cutoff(within));
    const today = this.startOfToday();
    return items.map((item) => {
      const due = new Date(`${item.dueDate}T00:00:00.000Z`);
      const daysRemaining = Math.round((due.getTime() - today.getTime()) / 86_400_000);
      return {
        ...item,
        daysRemaining,
        severity: daysRemaining < 0 ? 'overdue' : 'due_soon',
      };
    });
  }

  /** Employee headcount roster as a generic {@link ReportTable} for csv/xlsx/pdf export. */
  async rosterReport(): Promise<ReportTable> {
    const rows = await this.repo.roster();
    return {
      title: 'Employee headcount roster',
      subtitle: `${rows.length} employees`,
      columns: [
        { key: 'employeeNumber', header: 'Employee #' },
        { key: 'name', header: 'Name' },
        { key: 'jobTitle', header: 'Job title' },
        { key: 'department', header: 'Department' },
        { key: 'status', header: 'Status' },
        { key: 'hireDate', header: 'Hire date' },
      ],
      rows: rows.map((r) => ({
        employeeNumber: r.employeeNumber ?? '',
        name: `${r.firstNameEn} ${r.lastNameEn}`,
        jobTitle: r.jobTitle,
        department: r.department?.name ?? '',
        status: r.status,
        hireDate: r.hireDate ? r.hireDate.toISOString().slice(0, 10) : '',
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private cutoff(days: number): Date {
    const d = this.startOfToday();
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }
  private startOfToday(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}
