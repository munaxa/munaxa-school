/**
 * End-to-end smoke test for the per-parent Registration Agreement against a real PostgreSQL: one
 * agreement per guardian covering all their committed students, idempotent regeneration, and
 * supersede-with-a-new-version when a further child enrols. Drives RegistrationAgreementService.generate
 * directly (inside a tenant context) against seeded enrolments — no admissions HTTP flow needed.
 */
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { DocumentLanguage, FeeItemKind, QuotePaymentMode } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RegistrationAgreementService } from '../src/documents/registration-agreement.service';
import { TenantContextStore } from '../src/prisma/tenant-context';
import { withPlatform } from '../src/prisma/tenant.helpers';

const TENANT = 'aaaa1111-aaaa-1111-aaaa-111111111111';

describe('Registration Agreement — per-parent + supersede (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: RegistrationAgreementService;
  let actorUserId: string;
  const ids: { parentId: string; ay: string; grade: string; e1: string; e2: string } = {
    parentId: '',
    ay: '',
    grade: '',
    e1: '',
    e2: '',
  };

  const inTenant = <T>(fn: () => Promise<T>): Promise<T> =>
    TenantContextStore.run({ tenantId: TENANT, actorUserId }, fn);

  async function seedStudentWithEnrollment(opts: {
    qr: string;
    nationalId: string;
    firstEn: string;
    firstAr: string;
    tuition: number;
    transport: number;
    discount: number;
  }): Promise<string> {
    return withPlatform(prisma, async (tx) => {
      const grandTotal = opts.tuition + opts.transport - opts.discount;
      const student = await tx.student.create({
        data: {
          tenantId: TENANT,
          qrCode: opts.qr,
          nationalId: opts.nationalId,
          firstNameEn: opts.firstEn,
          lastNameEn: 'AbuHajj',
          firstNameAr: opts.firstAr,
          lastNameAr: 'أبوحاج',
        },
      });
      await tx.parentStudent.create({
        data: {
          tenantId: TENANT,
          parentId: ids.parentId,
          studentId: student.id,
          relation: 'FATHER',
          isPrimary: true,
        },
      });
      const quote = await tx.enrollmentQuote.create({
        data: {
          tenantId: TENANT,
          academicYearId: ids.ay,
          gradeId: ids.grade,
          studentId: student.id,
          paymentMode: QuotePaymentMode.FULL,
          installments: 1,
          firstDueDate: new Date('2026-09-01'),
          totalFees: opts.tuition + opts.transport,
          discountEligible: opts.tuition,
          discountAmount: opts.discount,
          nonDiscountEligible: opts.transport,
          grandTotal,
          items: {
            create: [
              {
                tenantId: TENANT,
                kind: FeeItemKind.TUITION,
                label: 'Tuition',
                amount: opts.tuition,
                discountable: true,
                discountAmount: opts.discount,
              },
              {
                tenantId: TENANT,
                kind: FeeItemKind.TRANSPORT,
                label: 'Transport',
                amount: opts.transport,
                discountAmount: 0,
              },
            ],
          },
        },
      });
      const enrollment = await tx.enrollment.create({
        data: {
          tenantId: TENANT,
          studentId: student.id,
          academicYearId: ids.ay,
          gradeId: ids.grade,
          quoteId: quote.id,
          status: 'COMMITTED',
          paymentMode: QuotePaymentMode.FULL,
        },
      });
      return enrollment.id;
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(RegistrationAgreementService);

    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: TENANT } });
      await tx.tenant.create({ data: { id: TENANT, name: 'agr', slug: 'agr', status: 'ACTIVE' } });
      const user = await tx.user.create({
        data: { tenantId: TENANT, email: 'r@agr.example', status: 'ACTIVE', passwordHash: 'x' },
      });
      actorUserId = user.id;
      const school = await tx.school.create({
        data: { tenantId: TENANT, nameEn: 'School', nameAr: 'مدرسة' },
      });
      const campus = await tx.campus.create({
        data: { tenantId: TENANT, schoolId: school.id, nameEn: 'Main', nameAr: 'الرئيسي' },
      });
      const ay = await tx.academicYear.create({
        data: {
          tenantId: TENANT,
          campusId: campus.id,
          name: '2025/2026',
          startDate: new Date('2025-08-01'),
          endDate: new Date('2026-06-30'),
        },
      });
      const grade = await tx.grade.create({
        data: { tenantId: TENANT, campusId: campus.id, level: 0, nameEn: 'KG', nameAr: 'روضة' },
      });
      const parent = await tx.parent.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'Tamer',
          lastNameEn: 'AbuHajj',
          firstNameAr: 'تامر',
          lastNameAr: 'أبوحاج',
          nationalId: '9871234567',
          phone: '+962 79 123 4567',
        },
      });
      ids.parentId = parent.id;
      ids.ay = ay.id;
      ids.grade = grade.id;
    });

    ids.e1 = await seedStudentWithEnrollment({
      qr: 'QR-SAIF',
      nationalId: '20212115',
      firstEn: 'Saif',
      firstAr: 'سيف',
      tuition: 1350,
      transport: 350,
      discount: 65,
    });
    ids.e2 = await seedStudentWithEnrollment({
      qr: 'QR-THIA',
      nationalId: '20242228',
      firstEn: 'Thia',
      firstAr: 'ثيا',
      tuition: 950,
      transport: 250,
      discount: 95,
    });
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  it('creates version 1 covering BOTH of the guardian’s students', async () => {
    const { agreement } = await inTenant(() => service.generate(ids.e1, DocumentLanguage.AR));
    expect(agreement.version).toBe(1);
    expect((agreement.feeBreakdown as unknown as unknown[]).length).toBe(2);
    expect(agreement.grandTotal.toFixed(3)).toBe('2740.000');
  });

  it('is idempotent: regenerating returns the same agreement (no new version)', async () => {
    const first = await inTenant(() => service.generate(ids.e1, DocumentLanguage.AR));
    const again = await inTenant(() => service.generate(ids.e2, DocumentLanguage.AR));
    expect(again.agreement.id).toBe(first.agreement.id);
    expect(again.agreement.version).toBe(1);
    const count = await withPlatform(prisma, (tx) =>
      tx.registrationAgreement.count({ where: { parentId: ids.parentId } }),
    );
    expect(count).toBe(1);
  });

  it('supersedes with version 2 when a third child enrols', async () => {
    const e3 = await seedStudentWithEnrollment({
      qr: 'QR-NOOR',
      nationalId: '20252229',
      firstEn: 'Noor',
      firstAr: 'نور',
      tuition: 800,
      transport: 0,
      discount: 0,
    });
    const { agreement } = await inTenant(() => service.generate(e3, DocumentLanguage.AR));

    expect(agreement.version).toBe(2);
    expect(agreement.supersedesId).toBeTruthy();
    expect((agreement.feeBreakdown as unknown as unknown[]).length).toBe(3);
    expect(agreement.grandTotal.toFixed(3)).toBe('3540.000');

    // The prior version is archived (immutable history), and exactly one current agreement remains.
    const rows = await withPlatform(prisma, (tx) =>
      tx.registrationAgreement.findMany({
        where: { parentId: ids.parentId },
        select: { version: true, status: true },
        orderBy: { version: 'asc' },
      }),
    );
    expect(rows.map((r) => `${r.version}:${r.status}`)).toEqual(['1:ARCHIVED', '2:GENERATED']);
  });
});
