import { Injectable } from '@nestjs/common';
import { Prisma, type Charge, type EInvoiceDocument, type EInvoiceSettings } from '@prisma/client';
import { TenantRepository } from '../common/tenant.repository';

export interface ChargeContext {
  charge: Charge;
  studentId: string;
  buyer: { name: string; nationalId: string | null; phone: string | null } | null;
  discountTotal: Prisma.Decimal;
}

/**
 * Read-side for the Finance ↔ JoFotara bridge: pulls a charge, its student's primary guardian
 * (the invoice buyer), the charge's active deductions, and any existing e-invoice for the charge.
 * All tenant-scoped via RLS like every repository.
 */
@Injectable()
export class FinanceBridgeRepository extends TenantRepository {
  settings(): Promise<EInvoiceSettings | null> {
    return this.run((tx, tenantId) => tx.eInvoiceSettings.findUnique({ where: { tenantId } }));
  }

  chargeContext(chargeId: string): Promise<ChargeContext | null> {
    return this.run(async (tx) => {
      const charge = await tx.charge.findFirst({ where: { id: chargeId } });
      if (!charge) return null;

      // Primary guardian first, else any linked parent.
      const links = await tx.parentStudent.findMany({
        where: { studentId: charge.studentId },
        orderBy: { isPrimary: 'desc' },
        select: {
          parent: {
            select: {
              firstNameEn: true,
              lastNameEn: true,
              firstNameAr: true,
              lastNameAr: true,
              nationalId: true,
              phone: true,
            },
          },
        },
      });
      const p = links[0]?.parent ?? null;
      const buyer = p
        ? {
            name:
              `${p.firstNameAr} ${p.lastNameAr}`.trim() ||
              `${p.firstNameEn} ${p.lastNameEn}`.trim(),
            nationalId: p.nationalId,
            phone: p.phone,
          }
        : null;

      const discountAgg = await tx.feeAdjustment.aggregate({
        where: { chargeId, status: 'APPLIED' },
        _sum: { amount: true },
      });

      return {
        charge,
        studentId: charge.studentId,
        buyer,
        discountTotal: discountAgg._sum.amount ?? new Prisma.Decimal(0),
      };
    });
  }

  /** A non-cancelled invoice already issued for this charge (idempotency guard). */
  existingInvoiceForCharge(chargeId: string): Promise<EInvoiceDocument | null> {
    return this.run((tx) =>
      tx.eInvoiceDocument.findFirst({
        where: { chargeId, docType: 'INVOICE', status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /** The accepted invoice for a charge — required to anchor a credit note (381). */
  acceptedInvoiceForCharge(chargeId: string): Promise<EInvoiceDocument | null> {
    return this.run((tx) =>
      tx.eInvoiceDocument.findFirst({
        where: { chargeId, docType: 'INVOICE', status: 'ACCEPTED' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }
}
