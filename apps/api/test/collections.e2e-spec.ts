/**
 * End-to-end tests for fee collections (Phase 18): the per-student legal/collections tag,
 * the reminder snapshot (this-month due + overdue), single + bulk late-payment reminders
 * (in-app notifications to parents), and the rule that LEGAL-tagged accounts are excluded
 * from reminders. Runs against a real PostgreSQL.
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/services/password.service';
import { RbacService } from '../src/auth/services/rbac.service';
import { withPlatform, withTenant } from '../src/prisma/tenant.helpers';
import { RoleKey } from '@school/domain';

const TENANT = 'c0117ec7-4444-4444-8444-444444444444';
const PASSWORD = 'Sup3rSecret!';

describe('Fee collections & reminders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let financeToken: string;
  let teacherToken: string;
  let parentUserId: string;
  let sOverdue: string; // has an overdue charge
  let sLegal: string; // overdue but LEGAL-tagged → excluded

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());
  const C = '/api/v1/finance/collections';

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
      await tx.tenant.create({ data: { id: TENANT, name: 'col', slug: 'col', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);
      const mkStudent = async (qr: string) => {
        const st = await tx.student.create({
          data: {
            tenantId: TENANT,
            firstNameEn: 'Kid',
            lastNameEn: qr,
            firstNameAr: 'طفل',
            lastNameAr: 'ب',
            qrCode: qr,
          },
        });
        return st.id;
      };
      sOverdue = await mkStudent(`QR-${TENANT}-od`);
      sLegal = await mkStudent(`QR-${TENANT}-lg`);

      const mkUser = async (email: string, role: RoleKey) => {
        const u = await tx.user.create({
          data: {
            tenantId: TENANT,
            email,
            status: 'ACTIVE',
            passwordHash: hash,
            mustChangePassword: false,
          },
        });
        await rbac.assignRole(tx, TENANT, u.id, role);
        return u.id;
      };
      await mkUser('finance@col.example', RoleKey.FinanceOfficer);
      await mkUser('teacher@col.example', RoleKey.Teacher);
      parentUserId = await mkUser('parent@col.example', RoleKey.Parent);

      // Link the parent to both students.
      const parent = await tx.parent.create({
        data: {
          tenantId: TENANT,
          userId: parentUserId,
          firstNameEn: 'Abu',
          lastNameEn: 'Ali',
          firstNameAr: 'أبو',
          lastNameAr: 'علي',
          phone: '+962790000000',
        },
      });
      for (const studentId of [sOverdue, sLegal]) {
        await tx.parentStudent.create({
          data: { tenantId: TENANT, parentId: parent.id, studentId, relation: 'FATHER' },
        });
      }

      // An overdue charge (due last month) for each student.
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      for (const studentId of [sOverdue, sLegal]) {
        const account = await tx.studentFinancialAccount.create({
          data: { tenantId: TENANT, studentId },
        });
        const charge = await tx.charge.create({
          data: {
            tenantId: TENANT,
            accountId: account.id,
            studentId,
            description: 'Tuition',
            amount: '500.000',
            dueDate: lastMonth,
            status: 'PENDING',
          },
        });
        await tx.installment.create({
          data: {
            tenantId: TENANT,
            chargeId: charge.id,
            seq: 1,
            dueDate: lastMonth,
            amount: '500.000',
          },
        });
      }
    });

    financeToken = await login('finance@col.example');
    teacherToken = await login('teacher@col.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'col' })
      .expect(200);
    return res.body.accessToken as string;
  }

  // -- Collections tag --------------------------------------------------------

  it('exposes a NONE collections tag and an overdue snapshot on the finance card', async () => {
    const res = await http().get(`${C}/students/${sOverdue}`).set(auth(financeToken)).expect(200);
    expect(res.body.collectionsStatus).toBe('NONE');
    expect(res.body.snapshot.overdue).toBe('500.000');
    expect(res.body.snapshot.eligible).toBe(true);
  });

  it('sets the FINANCIAL_ISSUE then LEGAL ("contact the lawyer") tag with a note', async () => {
    await http()
      .put(`${C}/students/${sLegal}`)
      .set(auth(financeToken))
      .send({ status: 'LEGAL', note: 'Referred to Adv. Khaled — case 2026/14' })
      .expect(200);
    const res = await http().get(`${C}/students/${sLegal}`).set(auth(financeToken)).expect(200);
    expect(res.body.collectionsStatus).toBe('LEGAL');
    expect(res.body.legalNote).toContain('Adv. Khaled');
    expect(res.body.flaggedAt).toBeTruthy();
  });

  // -- Reminders --------------------------------------------------------------

  it('sends an in-app reminder to the parent of an overdue (non-legal) student', async () => {
    const res = await http()
      .post(`${C}/students/${sOverdue}/reminders`)
      .set(auth(financeToken))
      .send({ channels: ['IN_APP', 'SMS'] })
      .expect(201);
    expect(res.body.recipients).toBe(1); // one linked parent with an account
    expect(res.body.smsSent).toBe(0); // SMS provider not configured → no-op
    expect(res.body.emailsSent).toBe(0); // no EMAIL channel requested here

    // The parent actually received a notification.
    const notes = await withTenant(prisma, TENANT, (tx) =>
      tx.notification.findMany({ where: { userId: parentUserId, category: 'FINANCE' } }),
    );
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes[0]!.body).toContain('500.000');
  });

  it('refuses to remind a LEGAL-tagged student (excluded — contact the lawyer)', async () => {
    await http()
      .post(`${C}/students/${sLegal}/reminders`)
      .set(auth(financeToken))
      .send({ channels: ['IN_APP'] })
      .expect(409);
  });

  it('bulk reminder hits the overdue account and skips the LEGAL one', async () => {
    const res = await http()
      .post(`${C}/reminders/send`)
      .set(auth(financeToken))
      .send({ channels: ['IN_APP'] })
      .expect(201);
    expect(res.body.candidates).toBe(2); // both have unpaid charges
    expect(res.body.sent).toBe(1); // only the non-legal overdue one
    expect(res.body.skippedLegal).toBe(1); // the LEGAL one is excluded
    expect(res.body.totalRecipients).toBe(1);
  });

  it('records reminder history on the finance card', async () => {
    const res = await http().get(`${C}/students/${sOverdue}`).set(auth(financeToken)).expect(200);
    expect(res.body.reminders.length).toBeGreaterThanOrEqual(2); // single + bulk
    expect(res.body.lastReminderAt).toBeTruthy();
  });

  // -- RBAC -------------------------------------------------------------------

  it('blocks tagging and reminders for a finance:read-only role', async () => {
    await http()
      .put(`${C}/students/${sOverdue}`)
      .set(auth(teacherToken))
      .send({ status: 'LEGAL' })
      .expect(403);
    await http()
      .post(`${C}/students/${sOverdue}/reminders`)
      .set(auth(teacherToken))
      .send({ channels: ['IN_APP'] })
      .expect(403);
  });

  // -- Promise to Pay ---------------------------------------------------------
  it('records a promise-to-pay, exposes it on the profile, and resolves it', async () => {
    const created = await http()
      .post(`${C}/students/${sOverdue}/promises`)
      .set(auth(financeToken))
      .send({ amount: '300.000', promiseBy: '2099-01-15', note: 'Father will pay after salary' })
      .expect(201);
    expect(created.body.amount).toBe('300.000');
    expect(created.body.status).toBe('OPEN'); // future date, unresolved

    // Appears on the finance card + the case moved to PROMISE_TO_PAY.
    const profile = await http()
      .get(`${C}/students/${sOverdue}`)
      .set(auth(financeToken))
      .expect(200);
    expect(profile.body.promises).toHaveLength(1);
    expect(profile.body.promises[0].id).toBe(created.body.id);

    const list = await http()
      .get(`${C}/students/${sOverdue}/promises`)
      .set(auth(financeToken))
      .expect(200);
    expect(list.body).toHaveLength(1);

    // Resolve as kept.
    const resolved = await http()
      .post(`${C}/promises/${created.body.id}/resolve`)
      .set(auth(financeToken))
      .send({ kept: true })
      .expect(201);
    expect(resolved.body.status).toBe('KEPT');
  });

  // -- Communication Log ------------------------------------------------------
  it('logs a parent communication and lists it (timestamped + audited)', async () => {
    const logged = await http()
      .post(`${C}/students/${sOverdue}/communications`)
      .set(auth(financeToken))
      .send({ medium: 'PHONE', note: 'Called father, discussed the overdue installment' })
      .expect(201);
    expect(logged.body.medium).toBe('PHONE');
    expect(logged.body.type).toBe('COMMUNICATION');

    const comms = await http()
      .get(`${C}/students/${sOverdue}/communications`)
      .set(auth(financeToken))
      .expect(200);
    expect(comms.body).toHaveLength(1);
    expect(comms.body[0].detail).toContain('Called father');

    // Also surfaced on the finance card.
    const profile = await http()
      .get(`${C}/students/${sOverdue}`)
      .set(auth(financeToken))
      .expect(200);
    expect(profile.body.communications).toHaveLength(1);

    // The audit trail recorded it.
    const audits = await withTenant(prisma, TENANT, (tx) =>
      tx.auditLog.findMany({ where: { action: 'finance.communication.log' } }),
    );
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it('blocks promises and communications for a finance:read-only role', async () => {
    await http()
      .post(`${C}/students/${sOverdue}/promises`)
      .set(auth(teacherToken))
      .send({ amount: '100.000', promiseBy: '2099-01-01' })
      .expect(403);
    await http()
      .post(`${C}/students/${sOverdue}/communications`)
      .set(auth(teacherToken))
      .send({ medium: 'NOTE', note: 'x' })
      .expect(403);
  });

  // -- Operational dashboard --------------------------------------------------
  it('serves the operational finance dashboard (workload + largest outstanding)', async () => {
    // A promise due today → surfaces in promisesDueToday.
    const today = new Date().toISOString().slice(0, 10);
    await http()
      .post(`${C}/students/${sOverdue}/promises`)
      .set(auth(financeToken))
      .send({ amount: '150.000', promiseBy: today })
      .expect(201);

    const res = await http().get(`${C}/dashboard`).set(auth(financeToken)).expect(200);
    const d = res.body;
    expect(Array.isArray(d.promisesDueToday)).toBe(true);
    expect(Array.isArray(d.transportSuspensions)).toBe(true);
    // The overdue students (500 each) are among the largest outstanding balances.
    expect(d.topOutstanding.length).toBeGreaterThanOrEqual(1);
    expect(d.topOutstanding.some((r: { studentId: string }) => r.studentId === sOverdue)).toBe(
      true,
    );
    // Workload counts are populated.
    expect(d.workload.overdueStudents).toBeGreaterThanOrEqual(1);
    expect(d.promisesDueToday.some((p: { studentId: string }) => p.studentId === sOverdue)).toBe(
      true,
    );
  });

  it('blocks the dashboard for a non-finance role', async () => {
    await http().get(`${C}/dashboard`).set(auth(teacherToken)).expect(403);
  });

  // -- Reminder levels --------------------------------------------------------
  it('sends a reminder at an escalation level and records the level on the dunning event', async () => {
    await http()
      .post(`${C}/students/${sOverdue}/reminders`)
      .set(auth(financeToken))
      .send({ channels: ['IN_APP'], level: 'FINAL' })
      .expect(201);
    const events = await withTenant(prisma, TENANT, (tx) =>
      tx.dunningEvent.findMany({
        where: { type: 'REMINDER', level: 'FINAL' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
    );
    expect(events.length).toBe(1);
    expect(events[0]!.level).toBe('FINAL');
  });

  // -- Manual transport suspend / reinstate -----------------------------------
  it('manually suspends and reinstates transport with a reason (audited) and surfaces it', async () => {
    await http()
      .post(`${C}/students/${sOverdue}/transport/suspend`)
      .set(auth(financeToken))
      .send({ reason: 'Overdue > 60 days despite reminders' })
      .expect(201);

    let profile = await http().get(`${C}/students/${sOverdue}`).set(auth(financeToken)).expect(200);
    expect(profile.body.transportSuspended).toBe(true);
    expect(profile.body.transportSuspendedReason).toContain('Overdue');
    expect(profile.body.transportSuspendedById).toBeTruthy();

    await http()
      .post(`${C}/students/${sOverdue}/transport/reinstate`)
      .set(auth(financeToken))
      .expect(201);

    profile = await http().get(`${C}/students/${sOverdue}`).set(auth(financeToken)).expect(200);
    expect(profile.body.transportSuspended).toBe(false);
    expect(profile.body.transportReinstatedAt).toBeTruthy();

    const audits = await withTenant(prisma, TENANT, (tx) =>
      tx.auditLog.findMany({
        where: { action: { in: ['finance.transport.suspend', 'finance.transport.restore'] } },
      }),
    );
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });

  it('blocks manual transport suspension for a finance:read-only role', async () => {
    await http()
      .post(`${C}/students/${sOverdue}/transport/suspend`)
      .set(auth(teacherToken))
      .send({ reason: 'x' })
      .expect(403);
  });
});
