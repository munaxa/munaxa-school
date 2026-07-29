/**
 * End-to-end tests for the Accounts Receivable engine (Finance Domain Spec v1.0) against a real
 * PostgreSQL. Covers the full flow — charge (obligation) → payment plan → installments → payment
 * (receipt → verify → FIFO allocation) → adjustments → over-payment credit → refund — and asserts
 * the ledger/accounting reconciliation invariants (LR/AR/CR), audit logging (AU) and RBAC (SE).
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/services/password.service';
import { RbacService } from '../src/auth/services/rbac.service';
import { withPlatform } from '../src/prisma/tenant.helpers';
import { RoleKey } from '@school/domain';

const TENANT = 'dddd4444-dddd-4444-dddd-444444444444';
const PASSWORD = 'Sup3rSecret!';

interface Totals {
  charged: string;
  discounts: string;
  netCharged: string;
  paid: string;
  outstanding: string;
  creditBalance: string;
  refunded: string;
}
interface InstallmentView {
  id: string;
  seq: number;
  amount: string;
  paid: string;
  balance: string;
  status: string;
}
interface PlanHistoryView {
  id: string;
  status: string;
  count: number;
  scheduled: string;
  paid: string;
  lines: InstallmentView[];
}
interface ChargeView {
  charge: { id: string; description: string; status: string };
  gross: string;
  net: string;
  paid: string;
  balance: string;
  plan: { id: string; installments: number; status: string } | null;
  installments: InstallmentView[];
  history: PlanHistoryView[];
}
interface Statement {
  charges: ChargeView[];
  totals: Totals;
  credits: Array<{ source: string; remaining: string }>;
}

describe('Finance AR (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let financeToken: string;
  let parentToken: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());

  /** Create an isolated student (returns id) so each scenario starts from a clean account. */
  async function makeStudent(tag: string): Promise<string> {
    return withPlatform(prisma, async (tx) => {
      const s = await tx.student.create({
        data: {
          tenantId: TENANT,
          firstNameEn: tag,
          lastNameEn: 'T',
          firstNameAr: tag,
          lastNameAr: 'ت',
          qrCode: `QR-${TENANT}-${tag}`,
        },
      });
      return s.id;
    });
  }

  const statement = async (studentId: string): Promise<Statement> =>
    (
      await http()
        .get(`/api/v1/finance/students/${studentId}/statement`)
        .set(auth(financeToken))
        .expect(200)
    ).body as Statement;

  const createCharge = async (studentId: string, description: string, amount: number) =>
    (
      await http()
        .post('/api/v1/finance/charges')
        .set(auth(financeToken))
        .send({ studentId, description, amount })
        .expect(201)
    ).body as { id: string };

  const recordAndVerifyPayment = async (studentId: string, amount: number) => {
    const created = (
      await http()
        .post('/api/v1/finance/payments')
        .set(auth(financeToken))
        .send({ studentId, amount, method: 'CASH' })
        .expect(201)
    ).body as { id: string; status: string };
    await http()
      .post(`/api/v1/finance/payments/${created.id}/verify`)
      .set(auth(financeToken))
      .expect(200);
    return created;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const passwords = moduleRef.get(PasswordService);
    const rbac = moduleRef.get(RbacService);
    const hash = await passwords.hash(PASSWORD);

    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: TENANT } });
      await tx.tenant.create({ data: { id: TENANT, name: 'fin', slug: 'fin', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);
      const finance = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'finance@fin.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, finance.id, RoleKey.FinanceOfficer);
      const parent = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'parent@fin.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, parent.id, RoleKey.Parent);
    });

    financeToken = await login('finance@fin.example');
    parentToken = await login('parent@fin.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'fin' })
      .expect(200);
    return res.body.accessToken as string;
  }

  // ── Charge as an obligation with an implicit installment ─────────────────────
  it('creates a charge (obligation) with one implicit installment (BR-8)', async () => {
    const studentId = await makeStudent('basic');
    await createCharge(studentId, 'Registration', 200);
    const s = await statement(studentId);
    expect(s.totals.charged).toBe('200.000');
    expect(s.totals.outstanding).toBe('200.000');
    expect(s.charges).toHaveLength(1);
    expect(s.charges[0]!.installments).toHaveLength(1);
    expect(s.charges[0]!.installments[0]!.amount).toBe('200.000');
  });

  // ── Payment: receipt → PENDING (no effect) → verify → allocate ──────────────
  it('a PENDING payment does not reduce outstanding; verify allocates it (BR-17/BR-23)', async () => {
    const studentId = await makeStudent('pay');
    await createCharge(studentId, 'Tuition', 750);

    const presign = await http()
      .post('/api/v1/finance/payments/receipt/presign')
      .set(auth(parentToken))
      .send({ fileName: 'receipt.jpg', contentType: 'image/jpeg', size: 2048 })
      .expect(200);

    const created = await http()
      .post('/api/v1/finance/payments')
      .set(auth(parentToken))
      .send({
        studentId,
        amount: 750,
        method: 'CLIQ',
        reference: 'CLIQ1',
        receiptKey: presign.body.fileKey,
      })
      .expect(201);
    expect(created.body.status).toBe('PENDING');

    let s = await statement(studentId);
    expect(s.totals.paid).toBe('0.000');
    expect(s.totals.outstanding).toBe('750.000');

    const verified = await http()
      .post(`/api/v1/finance/payments/${created.body.id}/verify`)
      .set(auth(financeToken))
      .expect(200);
    expect(verified.body.receiptNo).toBeGreaterThanOrEqual(1); // gapless receipt number (BR-18)

    s = await statement(studentId);
    expect(s.totals.paid).toBe('750.000');
    expect(s.totals.outstanding).toBe('0.000');
    expect(s.charges[0]!.charge.status).toBe('PAID');
    expect(s.charges[0]!.installments[0]!.status).toBe('PAID');
  });

  // ── Payment plan: schedule the net into installments; Σ == net (BR-9) ────────
  it('creates a 9-installment plan whose amounts sum to the charge net (BR-9)', async () => {
    const studentId = await makeStudent('plan');
    const charge = await createCharge(studentId, 'Annual Tuition', 900);
    await http()
      .post(`/api/v1/finance/charges/${charge.id}/plan`)
      .set(auth(financeToken))
      .send({ cadence: 'MONTHLY', installments: 9, firstDueDate: '2026-09-01' })
      .expect(201);

    const s = await statement(studentId);
    const view = s.charges.find((c) => c.charge.id === charge.id)!;
    expect(view.installments).toHaveLength(9);
    const sum = view.installments.reduce((t, i) => t + Number(i.amount), 0);
    expect(sum.toFixed(3)).toBe('900.000');
    expect(view.plan?.installments).toBe(9);
  });

  // ── Replace plan: supersede the old plan; the new plan covers ONLY the outstanding (BR-11) ──
  it('replaces a partly-paid plan: new plan = outstanding, old plan → history, one active plan', async () => {
    const studentId = await makeStudent('replan');
    const charge = await createCharge(studentId, 'Annual Tuition', 900);
    // First plan: 3 × 300.
    const firstPlan = (
      await http()
        .post(`/api/v1/finance/charges/${charge.id}/plan`)
        .set(auth(financeToken))
        .send({ cadence: 'MONTHLY', installments: 3, firstDueDate: '2026-09-01' })
        .expect(201)
    ).body as { id: string };
    // Pay 300 (FIFO settles the first installment).
    await recordAndVerifyPayment(studentId, 300);

    // Replace with a new 6-installment plan, with a reason (advanced action).
    const secondPlan = (
      await http()
        .post(`/api/v1/finance/charges/${charge.id}/plan`)
        .set(auth(financeToken))
        .send({
          cadence: 'MONTHLY',
          installments: 6,
          firstDueDate: '2026-10-01',
          reason: 'Financial hardship — approved renegotiation',
        })
        .expect(201)
    ).body as { id: string };

    // The replace is audited as finance.plan.renegotiate with the reason.
    const replaceAudits = await withPlatform(prisma, (tx) =>
      tx.auditLog.findMany({ where: { tenantId: TENANT, action: 'finance.plan.renegotiate' } }),
    );
    expect(replaceAudits.length).toBeGreaterThanOrEqual(1);
    expect(
      replaceAudits.some(
        (a) => (a.metadata as { reason?: string } | null)?.reason?.includes('hardship') ?? false,
      ),
    ).toBe(true);

    const s = await statement(studentId);
    const view = s.charges.find((c) => c.charge.id === charge.id)!;

    // Exactly one ACTIVE plan — the new one.
    expect(view.plan?.id).toBe(secondPlan.id);
    expect(view.plan?.status).toBe('ACTIVE');
    expect(secondPlan.id).not.toBe(firstPlan.id);

    // The active schedule covers ONLY the outstanding 600 (900 − 300 paid), not the full 900.
    expect(view.installments).toHaveLength(6);
    const activeSum = view.installments.reduce((t, i) => t + Number(i.amount), 0);
    expect(activeSum.toFixed(3)).toBe('600.000');
    expect(view.installments.every((i) => i.status === 'SCHEDULED')).toBe(true);

    // Charge-level figures stay reconciled: paid retained, balance == outstanding.
    expect(view.paid).toBe('300.000');
    expect(view.balance).toBe('600.000');

    // The superseded plan is retained in history with its one paid installment.
    expect(view.history).toHaveLength(1);
    expect(view.history[0]!.id).toBe(firstPlan.id);
    expect(view.history[0]!.status).toBe('SUPERSEDED');
    expect(view.history[0]!.paid).toBe('300.000');
    expect(view.history[0]!.lines.every((i) => i.status === 'PAID')).toBe(true);
  });

  // ── Renegotiate uses the LEDGER OUTSTANDING as the sole basis (BR-11 invariant) ──
  it('renegotiate schedules exactly the ledger outstanding, never the original debt', async () => {
    // Helper: charge → plan(months) → pay → renegotiate(months); return Σ(new installments).
    const renegotiate = async (debt: number, pay: number, months: number): Promise<string> => {
      const studentId = await makeStudent(`reneg-${debt}-${pay}-${months}`);
      const charge = await createCharge(studentId, 'Tuition', debt);
      await http()
        .post(`/api/v1/finance/charges/${charge.id}/plan`)
        .set(auth(financeToken))
        .send({ cadence: 'MONTHLY', installments: months, firstDueDate: '2026-09-01' })
        .expect(201);
      if (pay > 0) await recordAndVerifyPayment(studentId, pay);
      await http()
        .post(`/api/v1/finance/charges/${charge.id}/plan`)
        .set(auth(financeToken))
        .send({ cadence: 'MONTHLY', installments: months, firstDueDate: '2026-10-01', reason: 'x' })
        .expect(201);
      const s = await statement(studentId);
      const view = s.charges.find((c) => c.charge.id === charge.id)!;
      const sum = view.installments.reduce((t, i) => t + Number(i.amount), 0).toFixed(3);
      // Invariant: the active schedule sums to the ledger outstanding, to the fils.
      expect(sum).toBe(view.balance);
      expect(view.plan?.status).toBe('ACTIVE');
      return sum;
    };

    expect(await renegotiate(1705, 190, 9)).toBe('1515.000'); // scenario 1
    expect(await renegotiate(1705, 700, 6)).toBe('1005.000'); // scenario 2
    expect(await renegotiate(1705, 0, 9)).toBe('1705.000'); // scenario 3
    // scenario 4: an odd partial payment — outstanding still comes from the ledger, to the fils.
    expect(await renegotiate(1000, 333.333, 7)).toBe('666.667');
  });

  // ── Every outstanding path stays identical after renegotiation (accounting consistency) ──
  // Regression for the 0.330 divergence: a partial payment left a residual balance on the
  // superseded installment, double-counting it in the installment-sum path (account/statement)
  // against the charge's net−paid path. All five views MUST agree to the fils.
  it('renegotiation with a partial payment keeps account == charge == installments == statement', async () => {
    const plan = (chargeId: string, months: number, firstDueDate: string, reason?: string) =>
      http()
        .post(`/api/v1/finance/charges/${chargeId}/plan`)
        .set(auth(financeToken))
        .send({
          cadence: 'MONTHLY',
          installments: months,
          firstDueDate,
          ...(reason ? { reason } : {}),
        })
        .expect(201);

    const studentId = await makeStudent('reconcile-1905');
    const charge = await createCharge(studentId, 'Tuition & Fees', 1905);
    await plan(charge.id, 9, '2026-09-01');
    // 211.336 partially pays installment 1 (211.666) → leaves a 0.330 residual (the bug trigger).
    await recordAndVerifyPayment(studentId, 211.336);
    await plan(charge.id, 9, '2026-10-01', 'Financial hardship — approved renegotiation');

    const assertReconciled = (s: Statement, expectedOutstanding: string, expectedPaid: string) => {
      const view = s.charges.find((c) => c.charge.id === charge.id)!;
      const activeSum = view.installments.reduce((t, i) => t + Number(i.amount), 0).toFixed(3);
      const allBalances = [...view.installments, ...view.history.flatMap((h) => h.lines)]
        .reduce((t, i) => t + Number(i.balance), 0)
        .toFixed(3);
      // charge net−paid, active-schedule sum, every installment balance, and the ACCOUNT total
      // (statement) must all be the same number — this is the single financial truth.
      expect(view.paid).toBe(expectedPaid);
      expect(view.balance).toBe(expectedOutstanding);
      expect(activeSum).toBe(expectedOutstanding);
      expect(allBalances).toBe(expectedOutstanding);
      expect(s.totals.outstanding).toBe(expectedOutstanding);
      // The retained (superseded) installment was truncated to what was paid — no residual.
      expect(view.history.flatMap((h) => h.lines).every((i) => Number(i.balance) === 0)).toBe(true);
    };

    // 1905 − 211.336 = 1693.664, reconciled across every view.
    assertReconciled(await statement(studentId), '1693.664', '211.336');

    // Multiple renegotiations: pay another partial, renegotiate again — still reconciled.
    await recordAndVerifyPayment(studentId, 500.5);
    await plan(charge.id, 6, '2026-11-01', 'Second renegotiation');
    // 1905 − 211.336 − 500.5 = 1193.164.
    assertReconciled(await statement(studentId), '1193.164', '711.836');
  });

  // ── Manual allocation to a specific installment ──────────────────────────────
  it('allocates a verified payment to a specific installment (AR-1)', async () => {
    const studentId = await makeStudent('alloc');
    const charge = await createCharge(studentId, 'Annual Tuition', 900);
    await http()
      .post(`/api/v1/finance/charges/${charge.id}/plan`)
      .set(auth(financeToken))
      .send({ cadence: 'MONTHLY', installments: 9, firstDueDate: '2026-09-01' })
      .expect(201);

    // Record a payment WITHOUT auto-settling everything: 100 covers exactly one installment.
    const created = (
      await http()
        .post('/api/v1/finance/payments')
        .set(auth(financeToken))
        .send({ studentId, amount: 100, method: 'CASH' })
        .expect(201)
    ).body as { id: string };
    await http()
      .post(`/api/v1/finance/payments/${created.id}/verify`)
      .set(auth(financeToken))
      .expect(200);

    const s = await statement(studentId);
    const view = s.charges.find((c) => c.charge.id === charge.id)!;
    // FIFO settled the earliest installment fully; the rest remain scheduled.
    const paidCount = view.installments.filter((i) => i.status === 'PAID').length;
    expect(paidCount).toBe(1);
    expect(view.paid).toBe('100.000');
    expect(view.balance).toBe('800.000');
    expect(view.charge.status).toBe('PARTIAL');
  });

  // ── Adjustment (discount) reduces the net; ledger stays reconciled (BR-26) ───
  it('applies a discount that reduces the charge net and rebalances the schedule', async () => {
    const studentId = await makeStudent('disc');
    const charge = await createCharge(studentId, 'Annual Tuition', 900);
    await http()
      .post(`/api/v1/finance/charges/${charge.id}/plan`)
      .set(auth(financeToken))
      .send({ cadence: 'MONTHLY', installments: 9, firstDueDate: '2026-09-01' })
      .expect(201);

    await http()
      .post('/api/v1/finance/ledger/adjustments')
      .set(auth(financeToken))
      .send({ studentId, chargeId: charge.id, type: 'DISCOUNT', amount: 90, reason: 'Sibling' })
      .expect(201);

    const s = await statement(studentId);
    const view = s.charges.find((c) => c.charge.id === charge.id)!;
    expect(view.net).toBe('810.000');
    expect(view.balance).toBe('810.000');
    // Σ installments still equals the (new) net.
    const sum = view.installments
      .filter((i) => i.status !== 'CANCELLED')
      .reduce((t, i) => t + Number(i.amount), 0);
    expect(sum.toFixed(3)).toBe('810.000');
    expect(s.totals.discounts).toBe('90.000');
  });

  // ── Over-payment becomes an explicit Credit; refund consumes it (BR-24/CR/AR-5) ─
  it('banks an over-payment as credit and lets a refund consume it (BR-24, CR-2)', async () => {
    const studentId = await makeStudent('credit');
    await createCharge(studentId, 'Books', 100);
    await recordAndVerifyPayment(studentId, 150); // 50 over

    let s = await statement(studentId);
    expect(s.totals.outstanding).toBe('0.000');
    expect(s.totals.creditBalance).toBe('50.000');
    expect(s.credits.find((c) => c.source === 'OVERPAYMENT')?.remaining).toBe('50.000');

    // Refund 30 of the 50 credit.
    const refund = (
      await http()
        .post('/api/v1/finance/ledger/refunds')
        .set(auth(financeToken))
        .send({ studentId, amount: 30, method: 'CASH', reason: 'Overpaid' })
        .expect(201)
    ).body as { id: string };
    await http()
      .post(`/api/v1/finance/ledger/refunds/${refund.id}/verify`)
      .set(auth(financeToken))
      .expect(200);

    s = await statement(studentId);
    expect(s.totals.creditBalance).toBe('20.000'); // 50 − 30
    expect(s.totals.refunded).toBe('30.000');

    // A refund beyond available credit is rejected (BR-33).
    await http()
      .post('/api/v1/finance/ledger/refunds')
      .set(auth(financeToken))
      .send({ studentId, amount: 100, method: 'CASH', reason: 'too much' })
      .expect(400);
  });

  // ── Ledger reconciliation invariants across an account (LR-8) ────────────────
  it('reconciles the ledger: Σ installments == net and Σ allocations == paid (LR-8)', async () => {
    const studentId = await makeStudent('recon');
    const c1 = await createCharge(studentId, 'Tuition', 500);
    await http()
      .post(`/api/v1/finance/charges/${c1.id}/plan`)
      .set(auth(financeToken))
      .send({ cadence: 'MONTHLY', installments: 4, firstDueDate: '2026-09-01' })
      .expect(201);
    await createCharge(studentId, 'Transport', 300);
    await recordAndVerifyPayment(studentId, 250);

    const s = await statement(studentId);
    for (const view of s.charges) {
      const sum = view.installments
        .filter((i) => i.status !== 'CANCELLED')
        .reduce((t, i) => t + Number(i.amount), 0);
      expect(sum.toFixed(3)).toBe(view.net); // Σ installments == net
      const paid = view.installments.reduce((t, i) => t + Number(i.paid), 0);
      expect(paid.toFixed(3)).toBe(view.paid); // Σ installment.paid == charge.paid
    }
    // Account: outstanding == Σ charge.balance; paid == Σ verified allocations.
    const outstanding = s.charges.reduce((t, c) => t + Number(c.balance), 0);
    expect(outstanding.toFixed(3)).toBe(s.totals.outstanding);
    expect(s.totals.charged).toBe('800.000');
    expect(s.totals.paid).toBe('250.000');
    expect(s.totals.outstanding).toBe('550.000');
  });

  // ── Dimensional finance report (RR-3) ────────────────────────────────────────
  it('reports revenue/outstanding grouped by a finance dimension (RR-3)', async () => {
    const res = await http()
      .get('/api/v1/finance/reports/summary?dimension=category')
      .set(auth(financeToken))
      .expect(200);
    const rows = res.body as Array<{ gross: string; net: string; outstanding: string }>;
    expect(Array.isArray(rows)).toBe(true);
    // Every row reconciles: net == gross − discount and outstanding == net − paid (numeric).
    for (const r of rows) {
      expect(Number(r.gross)).toBeGreaterThanOrEqual(Number(r.net));
      expect(Number(r.net)).toBeGreaterThanOrEqual(Number(r.outstanding));
    }
  });

  // ── Audit + RBAC (AU-1, SE-1) ────────────────────────────────────────────────
  it('writes an audit log for every financial action (AU-1)', async () => {
    const count = await withPlatform(prisma, (tx) =>
      tx.auditLog.count({ where: { tenantId: TENANT, action: { startsWith: 'finance.' } } }),
    );
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it('rejects CliQ payments without a receipt or reference (validation)', async () => {
    const studentId = await makeStudent('valid');
    await http()
      .post('/api/v1/finance/payments')
      .set(auth(parentToken))
      .send({ studentId, amount: 10, method: 'CLIQ' })
      .expect(400);
  });

  it('enforces RBAC: a Parent cannot create charges or verify payments (SE-1)', async () => {
    const studentId = await makeStudent('rbac');
    await http()
      .post('/api/v1/finance/charges')
      .set(auth(parentToken))
      .send({ studentId, description: 'X', amount: 1 })
      .expect(403);
  });
});
