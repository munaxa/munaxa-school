/**
 * Local demo seed — creates a ready-to-use school you can log into.
 *
 * Plain PrismaClient + bcryptjs (no Nest DI — tsx doesn't emit the decorator metadata Nest needs),
 * mirroring prisma/seed.ts. Replicates the RBAC role provisioning from the domain permission map.
 * Idempotent; local development only.
 *
 *   pnpm --filter @school/api db:seed       # global permission catalog (run FIRST)
 *   pnpm --filter @school/api db:seed:demo  # this — demo tenant + admin login + a student
 *
 * Prints the login credentials at the end.
 */
import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ALL_PERMISSIONS, SCHOOL_ROLES, permissionsForRole } from '@school/domain';
import { InstallmentScheduleService } from '../src/finance/charges/installment-schedule.service';
import { fromFils, toFils } from '../src/finance/shared/money';

const TENANT_ID = 'ac276a70-7af3-4147-aa68-6b126e8f3a92';
const SLUG = 'demo';
const ADMIN_EMAIL = 'admin@demo.example';
const ADMIN_PASSWORD = 'ChangeMe123!';

const prisma = new PrismaClient();

/** Run fn with the platform RLS context set, so cross-tenant writes pass row-level security. */
function platform<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;
      return fn(tx as unknown as PrismaClient);
    },
    // Generous timeouts so the seed survives higher round-trip latency against a
    // remote/pooled database (e.g. a managed Postgres in another region).
    { maxWait: 60_000, timeout: 60_000 },
  );
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // Seed the global permission catalog here too, so this script is order-independent
  // (no need to run db:seed first). The Permission table is not tenant-scoped, but it
  // is RLS-protected: writes require the platform context, so run them via platform().
  await platform(async (tx) => {
    for (const key of ALL_PERMISSIONS) {
      const category = key.split(':')[0] ?? 'general';
      await tx.permission.upsert({
        where: { key },
        update: { category },
        create: { key, category },
      });
    }
  });

  await platform(async (tx) => {
    await tx.tenant.upsert({
      where: { id: TENANT_ID },
      create: { id: TENANT_ID, name: 'Green Valley School', slug: SLUG, status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
    });

    // Provision the school system roles + their permission mappings (mirrors RbacService).
    for (const key of SCHOOL_ROLES) {
      const role =
        (await tx.role.findFirst({ where: { tenantId: TENANT_ID, key: key } })) ??
        (await tx.role.create({
          data: { tenantId: TENANT_ID, key: key, scope: 'SCHOOL', isSystem: true },
        }));
      const permissionKeys = permissionsForRole(key);
      const permissions = await tx.permission.findMany({
        where: { key: { in: permissionKeys } },
        select: { id: true },
      });
      // Bulk insert (idempotent via skipDuplicates) instead of a per-permission
      // upsert loop: one query per role rather than hundreds of sequential
      // round-trips, so the transaction stays well within a pooled connection's
      // tolerance when seeding a remote/managed database.
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
          skipDuplicates: true,
        });
      }
    }

    const admin = await tx.user.upsert({
      where: { tenantId_email: { tenantId: TENANT_ID, email: ADMIN_EMAIL } },
      create: {
        tenantId: TENANT_ID,
        email: ADMIN_EMAIL,
        status: 'ACTIVE',
        passwordHash,
        mustChangePassword: false,
        firstNameEn: 'School',
        lastNameEn: 'Admin',
      },
      update: { passwordHash, status: 'ACTIVE', mustChangePassword: false },
    });
    const adminRole = await tx.role.findFirstOrThrow({
      where: { tenantId: TENANT_ID, key: 'SchoolAdmin' },
    });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { tenantId: TENANT_ID, userId: admin.id, roleId: adminRole.id },
    });

    // A sample student so the Finance/People screens have something to show. National-id uniqueness
    // is now a PARTIAL index (live rows only), so there is no compound where-unique to upsert on —
    // find the existing live student, else create.
    const student =
      (await tx.student.findFirst({
        where: { tenantId: TENANT_ID, nationalId: '9901012345', deletedAt: null },
      })) ??
      (await tx.student.create({
        data: {
          tenantId: TENANT_ID,
          firstNameEn: 'Omar',
          lastNameEn: 'Haddad',
          firstNameAr: 'عمر',
          lastNameAr: 'الحداد',
          fatherNameEn: 'Khalid',
          nationalId: '9901012345',
          qrCode: `QR-${TENANT_ID}-omar`,
        },
      }));

    await seedFinance(tx, student.id);
  });
  console.log(
    `\n✔ Demo ready.\n  Portal:   http://localhost:3000\n  Tenant:   ${SLUG}\n  Email:    ${ADMIN_EMAIL}\n  Password: ${ADMIN_PASSWORD}\n`,
  );
  await prisma.$disconnect();
}

/**
 * Demo AR ledger for the sample student (Finance Domain Spec v1.0): a Student Financial Account
 * with three charges (an Annual Tuition obligation paid over a 9-month plan, plus Registration and
 * Transport), a couple of verified payments allocated to installments, and one discount — so the
 * hierarchical Student Finance page has realistic Account → Charge → Plan → Installment data.
 * Idempotent: skips if the account already exists. Uses the real schedule engine (single source).
 */
async function seedFinance(tx: PrismaClient, studentId: string): Promise<void> {
  const existing = await tx.studentFinancialAccount.findFirst({ where: { studentId } });
  if (existing) return;

  const account = await tx.studentFinancialAccount.create({
    data: { tenantId: TENANT_ID, studentId },
  });
  const schedule = new InstallmentScheduleService();

  // 1) Annual Tuition = 3,000 JOD over a 9-month plan (Σ installments == net).
  const tuition = await tx.charge.create({
    data: {
      tenantId: TENANT_ID,
      accountId: account.id,
      studentId,
      description: 'Annual Tuition 2026/27',
      amount: '3000.000',
      dueDate: new Date('2026-09-01'),
      status: 'PENDING',
    },
  });
  // A sibling discount on tuition (traceable adjustment) → net 2,850 scheduled across the plan.
  await tx.feeAdjustment.create({
    data: {
      tenantId: TENANT_ID,
      accountId: account.id,
      studentId,
      chargeId: tuition.id,
      type: 'SIBLING_DISCOUNT',
      amount: '150.000',
      reason: 'Sibling discount (2 children enrolled)',
    },
  });
  const plan = await tx.paymentPlan.create({
    data: {
      tenantId: TENANT_ID,
      chargeId: tuition.id,
      cadence: 'MONTHLY',
      installments: 9,
      firstDueDate: new Date('2026-09-01'),
    },
  });
  const lines = schedule.generate(toFils('2850.000'), {
    cadence: 'MONTHLY',
    installments: 9,
    firstDueDate: '2026-09-01',
  });
  const tuitionInstallments = [] as { id: string; amount: Prisma.Decimal }[];
  for (const line of lines) {
    const inst = await tx.installment.create({
      data: {
        tenantId: TENANT_ID,
        chargeId: tuition.id,
        planId: plan.id,
        seq: line.seq,
        dueDate: line.dueDate,
        amount: fromFils(line.amountFils),
      },
    });
    tuitionInstallments.push({ id: inst.id, amount: inst.amount });
  }

  // 2) Registration = 200 JOD (no plan → one implicit installment), paid in full.
  const registration = await tx.charge.create({
    data: {
      tenantId: TENANT_ID,
      accountId: account.id,
      studentId,
      description: 'Registration',
      amount: '200.000',
      dueDate: new Date('2026-08-01'),
      status: 'PAID',
    },
  });
  const regInstallment = await tx.installment.create({
    data: {
      tenantId: TENANT_ID,
      chargeId: registration.id,
      seq: 1,
      dueDate: new Date('2026-08-01'),
      amount: '200.000',
      status: 'PAID',
    },
  });

  // 3) Transportation = 600 JOD, unpaid.
  const transport = await tx.charge.create({
    data: {
      tenantId: TENANT_ID,
      accountId: account.id,
      studentId,
      description: 'Transportation (two-way)',
      amount: '600.000',
      dueDate: new Date('2026-09-01'),
      status: 'PENDING',
    },
  });
  await tx.installment.create({
    data: {
      tenantId: TENANT_ID,
      chargeId: transport.id,
      seq: 1,
      dueDate: new Date('2026-09-01'),
      amount: '600.000',
    },
  });

  // Payments: registration paid in full; the first tuition installment settled.
  const regPayment = await tx.payment.create({
    data: {
      tenantId: TENANT_ID,
      accountId: account.id,
      studentId,
      amount: '200.000',
      method: 'CASH',
      status: 'VERIFIED',
      receiptNo: 1,
      verifiedAt: new Date('2026-08-02'),
    },
  });
  await tx.paymentAllocation.create({
    data: {
      tenantId: TENANT_ID,
      paymentId: regPayment.id,
      installmentId: regInstallment.id,
      amount: '200.000',
    },
  });

  const first = tuitionInstallments[0]!;
  const tuitionPayment = await tx.payment.create({
    data: {
      tenantId: TENANT_ID,
      accountId: account.id,
      studentId,
      amount: first.amount,
      method: 'CLIQ',
      reference: 'CLIQ-DEMO-1',
      status: 'VERIFIED',
      receiptNo: 2,
      verifiedAt: new Date('2026-09-02'),
    },
  });
  await tx.paymentAllocation.create({
    data: {
      tenantId: TENANT_ID,
      paymentId: tuitionPayment.id,
      installmentId: first.id,
      amount: first.amount,
    },
  });
  await tx.installment.update({ where: { id: first.id }, data: { status: 'PAID' } });
  await tx.charge.update({ where: { id: tuition.id }, data: { status: 'PARTIAL' } });

  // Keep the receipt counter consistent with the two demo receipts issued.
  await tx.paymentReceiptCounter.upsert({
    where: { tenantId: TENANT_ID },
    create: { tenantId: TENANT_ID, nextReceiptNo: 3 },
    update: { nextReceiptNo: 3 },
  });
}

main().catch(async (e) => {
  console.error('Demo seed failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
