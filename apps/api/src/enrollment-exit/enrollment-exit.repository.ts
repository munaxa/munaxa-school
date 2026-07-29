import { Injectable } from '@nestjs/common';
import { AdmissionStatus, EnrollmentStatus, FeeItemKind, Prisma } from '@prisma/client';
import { TenantRepository } from '../common/tenant.repository';

export interface EnrollmentChargeSummary {
  enrollmentId: string;
  studentId: string;
  admissionStatus: AdmissionStatus;
  status: EnrollmentStatus;
  charges: {
    id: string;
    status: string;
    isRegistration: boolean;
    fullyUnpaid: boolean; // no PAID/PARTIAL installment → safe to void
  }[];
  hasSettledMoney: boolean; // any PAID/PARTIAL installment anywhere on the enrollment
}

/** Data access for enrollment exit (withdrawal / cancel admission) — reads ledger state, voids admission. */
@Injectable()
export class EnrollmentExitRepository extends TenantRepository {
  /** The enrollment + its charges with just enough ledger state to drive settlement decisions. */
  chargeSummary(enrollmentId: string): Promise<EnrollmentChargeSummary | null> {
    return this.run(async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: { id: enrollmentId },
        select: { id: true, studentId: true, admissionStatus: true, status: true },
      });
      if (!enrollment) return null;

      const charges = await tx.charge.findMany({
        where: { enrollmentId },
        select: {
          id: true,
          status: true,
          feeItem: { select: { kind: true } },
          installments: { select: { status: true } },
        },
      });

      const settled = (s: string) => s === 'PAID' || s === 'PARTIAL';
      const chargeRows = charges.map((c) => {
        const fullyUnpaid = !c.installments.some((i) => settled(i.status));
        return {
          id: c.id,
          status: c.status,
          isRegistration: c.feeItem?.kind === FeeItemKind.REGISTRATION,
          fullyUnpaid,
        };
      });

      return {
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        admissionStatus: enrollment.admissionStatus,
        status: enrollment.status,
        charges: chargeRows,
        hasSettledMoney: chargeRows.some((c) => !c.fullyUnpaid),
      };
    });
  }

  /**
   * Void an admission (Cancel Admission — pre-active). Marks the enrollment CANCELLED on BOTH the
   * workflow (admissionStatus) and the participation (status) axes; charge voiding is done by the
   * caller via the shared ChargeService.cancel. Never deletes history; writes an audit row.
   */
  voidAdmission(enrollmentId: string, reason?: string) {
    return this.run(async (tx, tenantId) => {
      const enrollment = await tx.enrollment.update({
        where: { id: enrollmentId },
        data: {
          admissionStatus: AdmissionStatus.CANCELLED,
          status: EnrollmentStatus.CANCELLED,
          ...(reason !== undefined ? { reason } : {}),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'admissions.cancelAdmission',
        entityType: 'Enrollment',
        entityId: enrollmentId,
        ...(reason ? { metadata: { reason } } : {}),
      });
      return enrollment;
    });
  }

  /** Record the withdrawal settlement outcome (thin audit — the ledger holds the actual effects). */
  auditWithdrawalSettlement(enrollmentId: string, metadata: Prisma.InputJsonObject) {
    return this.run((tx, tenantId) =>
      this.writeAudit(tx, tenantId, {
        action: 'finance.withdrawalSettlement',
        entityType: 'Enrollment',
        entityId: enrollmentId,
        metadata,
      }),
    );
  }

  /** Record a reactivation (withdrawal reversal) — the reopened charges are the ledger effect. */
  auditReactivation(enrollmentId: string, metadata: Prisma.InputJsonObject) {
    return this.run((tx, tenantId) =>
      this.writeAudit(tx, tenantId, {
        action: 'enrollment.reactivate',
        entityType: 'Enrollment',
        entityId: enrollmentId,
        metadata,
      }),
    );
  }
}
