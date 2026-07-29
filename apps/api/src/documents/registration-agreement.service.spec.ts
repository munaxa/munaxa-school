import { DocumentLanguage, FeeItemKind, Prisma, QuotePaymentMode } from '@prisma/client';
import { RegistrationAgreementService } from './registration-agreement.service';

/**
 * Unit coverage for the per-parent generation logic: one agreement per guardian+year covering all
 * their committed students, idempotent on unchanged content, superseded with a new version when the
 * guardian's enrolments/fees change. The repository + engine are mocked (no DB).
 */

const dec = (v: string) => new Prisma.Decimal(v);

/** A committed enrolment shaped like DocumentRepository.enrollmentContext / guardianEnrollments. */
function mockEnrollment(opts: {
  id: string;
  studentId: string;
  nameEn: string;
  nameAr: string;
  nationalId: string;
  tuition: string;
  transport?: string;
  discount?: string;
  grandTotal: string;
  parentId?: string;
}) {
  const items: Array<{
    kind: FeeItemKind;
    amount: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
  }> = [
    {
      kind: FeeItemKind.TUITION,
      amount: dec(opts.tuition),
      discountAmount: dec(opts.discount ?? '0.000'),
    },
  ];
  if (opts.transport) {
    items.push({
      kind: FeeItemKind.TRANSPORT,
      amount: dec(opts.transport),
      discountAmount: dec('0.000'),
    });
  }
  return {
    id: opts.id,
    studentId: opts.studentId,
    academicYearId: 'ay1',
    gradeId: 'g1',
    createdAt: new Date('2026-06-28T00:00:00Z'),
    paymentMode: QuotePaymentMode.FULL,
    registrationFeePaid: true,
    academicYear: { id: 'ay1', name: '2025/2026', campusId: 'c1' },
    grade: { id: 'g1', nameEn: 'Grade 1', nameAr: 'الصف الأول' },
    quote: {
      grandTotal: dec(opts.grandTotal),
      paymentMode: QuotePaymentMode.FULL,
      installments: 1,
      firstDueDate: new Date('2026-09-01T00:00:00Z'),
      items,
    },
    student: {
      nationalId: opts.nationalId,
      firstNameEn: opts.nameEn.split(' ')[0],
      lastNameEn: opts.nameEn.split(' ').slice(1).join(' '),
      firstNameAr: opts.nameAr.split(' ')[0],
      lastNameAr: opts.nameAr.split(' ').slice(1).join(' '),
      section: null,
      parentLinks: [
        {
          isPrimary: true,
          parent: {
            id: opts.parentId ?? 'p1',
            firstNameEn: 'Sara',
            lastNameEn: 'Ali',
            firstNameAr: 'سارة',
            lastNameAr: 'علي',
            nationalId: '9871234567',
            phone: '+962 79 123 4567',
          },
        },
      ],
    },
  };
}

function makeService(repo: Record<string, jest.Mock>) {
  const engine = {
    resolveBranding: jest.fn().mockResolvedValue({ nameEn: 'Test', addressLines: [] }),
    render: jest
      .fn()
      .mockResolvedValue({ buffer: Buffer.from('%PDF-1.7'), checksum: 'x', byteSize: 8 }),
  };
  const service = new RegistrationAgreementService(engine as never, repo as never, {} as never);
  return { service, engine };
}

describe('RegistrationAgreementService.generate (per-parent + supersede)', () => {
  const child1 = mockEnrollment({
    id: 'e1',
    studentId: 's1',
    nameEn: 'Saif AbuHajj',
    nameAr: 'سيف أبوحاج',
    nationalId: '20212115',
    tuition: '1350.000',
    transport: '350.000',
    discount: '65.000',
    grandTotal: '1635.000',
  });
  const child2 = mockEnrollment({
    id: 'e2',
    studentId: 's2',
    nameEn: 'Thia AbuHajj',
    nameAr: 'ثيا أبوحاج',
    nationalId: '20242228',
    tuition: '950.000',
    transport: '250.000',
    discount: '95.000',
    grandTotal: '1105.000',
  });

  it('creates version 1 covering ALL of the guardian’s students', async () => {
    const persistAgreement = jest.fn().mockResolvedValue({ agreement: { id: 'a1' }, document: {} });
    const repo = {
      enrollmentContext: jest.fn().mockResolvedValue(child1),
      guardianEnrollments: jest.fn().mockResolvedValue([child1, child2]),
      familyPlanSchedule: jest.fn().mockResolvedValue({ hasPlan: false, schedule: [] }),
      currentAgreementForParentYear: jest.fn().mockResolvedValue(null),
      persistAgreement,
    };
    const { service } = makeService(repo);

    await service.generate('e1', DocumentLanguage.EN);

    expect(persistAgreement).toHaveBeenCalledTimes(1);
    const arg = persistAgreement.mock.calls[0]![0];
    expect(arg.version).toBe(1);
    expect(arg.supersedesId).toBeNull();
    // Both students are aggregated into the snapshot's fee table, and totals are the family sum.
    expect(arg.feeBreakdown).toHaveLength(2);
    expect(arg.grandTotal.toFixed(3)).toBe('2740.000');
    expect(arg.dataSnapshot.students.map((s: { nameEn: string }) => s.nameEn)).toEqual([
      'Saif AbuHajj',
      'Thia AbuHajj',
    ]);
  });

  it('is idempotent: unchanged content returns the current agreement without a new version', async () => {
    const persistAgreement = jest.fn();
    // The "current" agreement stores exactly the fee breakdown / schedule the same inputs produce.
    const students = [
      {
        nameEn: 'Saif AbuHajj',
        tuition: '1350.000',
        transportation: '350.000',
        discount: '65.000',
        net: '1635.000',
      },
      {
        nameEn: 'Thia AbuHajj',
        tuition: '950.000',
        transportation: '250.000',
        discount: '95.000',
        net: '1105.000',
      },
    ];
    const schedule = [{ index: 1, dueDate: '2026-09-01', amount: '2740.000' }];
    const current = {
      id: 'a1',
      version: 1,
      feeBreakdown: students,
      installmentSchedule: schedule,
      grandTotal: dec('2740.000'),
      // Existing agreement was rendered in English; regenerating in the same language is idempotent.
      document: { id: 'doc1', language: DocumentLanguage.EN },
    };
    const repo = {
      enrollmentContext: jest.fn().mockResolvedValue(child1),
      guardianEnrollments: jest.fn().mockResolvedValue([child1, child2]),
      familyPlanSchedule: jest.fn().mockResolvedValue({ hasPlan: false, schedule: [] }),
      currentAgreementForParentYear: jest.fn().mockResolvedValue(current),
      persistAgreement,
    };
    const { service, engine } = makeService(repo);

    const result = await service.generate('e1', DocumentLanguage.EN);

    expect(persistAgreement).not.toHaveBeenCalled();
    expect(engine.render).not.toHaveBeenCalled();
    expect(result).toEqual({
      agreement: expect.objectContaining({ id: 'a1' }),
      document: { id: 'doc1', language: DocumentLanguage.EN },
    });
  });

  it('regenerates a new version when the language changes (e.g. English → bilingual)', async () => {
    const persistAgreement = jest.fn().mockResolvedValue({ agreement: { id: 'a2' }, document: {} });
    const students = [
      {
        nameEn: 'Saif AbuHajj',
        tuition: '1350.000',
        transportation: '350.000',
        discount: '65.000',
        net: '1635.000',
      },
      {
        nameEn: 'Thia AbuHajj',
        tuition: '950.000',
        transportation: '250.000',
        discount: '95.000',
        net: '1105.000',
      },
    ];
    // Same material content as the current agreement, but that one was rendered in English.
    const current = {
      id: 'a1',
      version: 1,
      feeBreakdown: students,
      installmentSchedule: [{ index: 1, dueDate: '2026-09-01', amount: '2740.000' }],
      grandTotal: dec('2740.000'),
      document: { id: 'doc1', language: DocumentLanguage.EN },
    };
    const repo = {
      enrollmentContext: jest.fn().mockResolvedValue(child1),
      guardianEnrollments: jest.fn().mockResolvedValue([child1, child2]),
      familyPlanSchedule: jest.fn().mockResolvedValue({ hasPlan: false, schedule: [] }),
      currentAgreementForParentYear: jest.fn().mockResolvedValue(current),
      persistAgreement,
    };
    const { service } = makeService(repo);

    await service.generate('e1', DocumentLanguage.BILINGUAL);

    expect(persistAgreement).toHaveBeenCalledTimes(1);
    const arg = persistAgreement.mock.calls[0]![0];
    expect(arg.version).toBe(2);
    expect(arg.supersedesId).toBe('a1');
    expect(arg.language).toBe(DocumentLanguage.BILINGUAL);
  });

  it('supersedes with a new version when a second child enrols', async () => {
    const persistAgreement = jest.fn().mockResolvedValue({ agreement: { id: 'a2' }, document: {} });
    // The current agreement was for child1 only; child2 has since enrolled → content changed.
    const current = {
      id: 'a1',
      version: 1,
      feeBreakdown: [
        {
          nameEn: 'Saif AbuHajj',
          tuition: '1350.000',
          transportation: '350.000',
          discount: '65.000',
          net: '1635.000',
        },
      ],
      installmentSchedule: [{ index: 1, dueDate: '2026-09-01', amount: '1635.000' }],
      grandTotal: dec('1635.000'),
      document: { id: 'doc1' },
    };
    const repo = {
      enrollmentContext: jest.fn().mockResolvedValue(child1),
      guardianEnrollments: jest.fn().mockResolvedValue([child1, child2]),
      familyPlanSchedule: jest.fn().mockResolvedValue({ hasPlan: false, schedule: [] }),
      currentAgreementForParentYear: jest.fn().mockResolvedValue(current),
      persistAgreement,
    };
    const { service } = makeService(repo);

    await service.generate('e1', DocumentLanguage.EN);

    expect(persistAgreement).toHaveBeenCalledTimes(1);
    const arg = persistAgreement.mock.calls[0]![0];
    expect(arg.version).toBe(2);
    expect(arg.supersedesId).toBe('a1');
    expect(arg.feeBreakdown).toHaveLength(2);
  });

  it('bills the registration fee once and spreads only the remainder across installments', async () => {
    // A single INSTALLMENTS enrolment: 300 registration (one-off) + 900 tuition over 3 months.
    const enrollment = {
      ...mockEnrollment({
        id: 'e1',
        studentId: 's1',
        nameEn: 'Omar AbuHajj',
        nameAr: 'عمر أبوحاج',
        nationalId: '30303030',
        tuition: '900.000',
        grandTotal: '1200.000',
      }),
      paymentMode: QuotePaymentMode.INSTALLMENTS,
      quote: {
        grandTotal: dec('1200.000'),
        paymentMode: QuotePaymentMode.INSTALLMENTS,
        installments: 3,
        firstDueDate: new Date('2026-09-01T00:00:00Z'),
        items: [
          { kind: FeeItemKind.REGISTRATION, amount: dec('300.000'), discountAmount: dec('0.000') },
          { kind: FeeItemKind.TUITION, amount: dec('900.000'), discountAmount: dec('0.000') },
        ],
      },
    };
    const persistAgreement = jest.fn().mockResolvedValue({ agreement: { id: 'a1' }, document: {} });
    const repo = {
      enrollmentContext: jest.fn().mockResolvedValue(enrollment),
      guardianEnrollments: jest.fn().mockResolvedValue([enrollment]),
      familyPlanSchedule: jest.fn().mockResolvedValue({ hasPlan: false, schedule: [] }),
      currentAgreementForParentYear: jest.fn().mockResolvedValue(null),
      persistAgreement,
    };
    const { service } = makeService(repo);

    await service.generate('e1', DocumentLanguage.EN);

    const arg = persistAgreement.mock.calls[0]![0];
    // Registration is a single line due at registration; the 900 remainder is split into 3 × 300.
    expect(arg.installmentSchedule).toEqual([
      { index: 1, dueDate: '2026-06-28', amount: '300.000' },
      { index: 2, dueDate: '2026-09-01', amount: '300.000' },
      { index: 3, dueDate: '2026-10-01', amount: '300.000' },
      { index: 4, dueDate: '2026-11-01', amount: '300.000' },
    ]);
    // The family grand total still includes the registration fee.
    expect(arg.grandTotal.toFixed(3)).toBe('1200.000');
  });

  it('folds the registration fee into the installments when it was not paid at registration', async () => {
    // Same quote, but registrationFeePaid=false → the whole 1200 is split into 3 × 400 monthly.
    const enrollment = {
      ...mockEnrollment({
        id: 'e1',
        studentId: 's1',
        nameEn: 'Omar AbuHajj',
        nameAr: 'عمر أبوحاج',
        nationalId: '30303030',
        tuition: '900.000',
        grandTotal: '1200.000',
      }),
      paymentMode: QuotePaymentMode.INSTALLMENTS,
      registrationFeePaid: false,
      quote: {
        grandTotal: dec('1200.000'),
        paymentMode: QuotePaymentMode.INSTALLMENTS,
        installments: 3,
        firstDueDate: new Date('2026-09-01T00:00:00Z'),
        items: [
          { kind: FeeItemKind.REGISTRATION, amount: dec('300.000'), discountAmount: dec('0.000') },
          { kind: FeeItemKind.TUITION, amount: dec('900.000'), discountAmount: dec('0.000') },
        ],
      },
    };
    const persistAgreement = jest.fn().mockResolvedValue({ agreement: { id: 'a1' }, document: {} });
    const repo = {
      enrollmentContext: jest.fn().mockResolvedValue(enrollment),
      guardianEnrollments: jest.fn().mockResolvedValue([enrollment]),
      familyPlanSchedule: jest.fn().mockResolvedValue({ hasPlan: false, schedule: [] }),
      currentAgreementForParentYear: jest.fn().mockResolvedValue(null),
      persistAgreement,
    };
    const { service } = makeService(repo);

    await service.generate('e1', DocumentLanguage.EN);

    const arg = persistAgreement.mock.calls[0]![0];
    expect(arg.installmentSchedule).toEqual([
      { index: 1, dueDate: '2026-09-01', amount: '400.000' },
      { index: 2, dueDate: '2026-10-01', amount: '400.000' },
      { index: 3, dueDate: '2026-11-01', amount: '400.000' },
    ]);
  });
});
