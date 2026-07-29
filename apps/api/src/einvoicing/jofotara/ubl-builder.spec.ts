import type { EInvoiceDocument, EInvoiceSettings } from '@prisma/client';
import { buildJoFotaraXml, fmtAmount, invoiceTypeCode } from './ubl-builder';
import type { BuildContext, EInvoiceLineItem } from '../provider.types';

/**
 * Compliance tests for the JoFotara UBL 2.1 builder — each assertion traces to a rule in
 * docs/integrations/jofotara/01-compliance-analysis.md.
 */

const settings = (over: Partial<EInvoiceSettings> = {}): EInvoiceSettings => ({
  id: 's1',
  tenantId: 't1',
  provider: 'jofotara',
  enabled: true,
  environment: 'SIMULATION',
  endpointUrl: null,
  legalNameEn: 'Green Valley School',
  legalNameAr: 'مدرسة الوادي الأخضر',
  taxNumber: '123456789',
  vatNumber: null,
  commercialRegistration: null,
  addressLine: null,
  city: 'Amman',
  countryCode: 'JO',
  phone: null,
  email: null,
  taxpayerType: 'SALES',
  vatEnabled: true,
  vatPercent: null,
  defaultTaxCategory: 'S',
  defaultPaymentKind: 'RECEIVABLE',
  autoIssueOnCharge: false,
  autoCreditOnAdjustment: false,
  fieldMappings: null,
  templateConfig: null,
  completedSteps: 7,
  lastTestAt: null,
  lastTestOk: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const doc = (over: Partial<EInvoiceDocument> = {}): EInvoiceDocument => ({
  id: 'd1',
  tenantId: 't1',
  docType: 'INVOICE',
  paymentKind: 'RECEIVABLE',
  status: 'QUEUED',
  invoiceNumber: 'INV-2026-0001',
  uuid: '7f1c0a45-9f1e-4d4a-9a8e-0b1c2d3e4f5a',
  icv: BigInt(7),
  chargeId: null,
  paymentId: null,
  studentId: null,
  buyerName: 'عمر خالد الحداد',
  buyerIdScheme: 'NIN',
  buyerIdValue: '9901012345',
  buyerPhone: '0791234567',
  buyerCity: 'JO-AM',
  originalDocumentId: null,
  creditReason: null,
  currency: 'JOD',
  taxExclusive: 750 as never,
  taxAmount: 120 as never,
  discountTotal: 0 as never,
  payableAmount: 870 as never,
  lines: [] as never,
  submittedXml: null,
  signedInvoice: null,
  qrCode: null,
  providerUuid: null,
  validationResults: null,
  lastError: null,
  attempts: 0,
  nextAttemptAt: null,
  issuedAt: new Date('2026-06-09T08:00:00Z'),
  acceptedAt: null,
  createdById: null,
  createdAt: new Date('2026-06-09T08:00:00Z'),
  updatedAt: new Date(),
  ...over,
});

const lines: EInvoiceLineItem[] = [
  {
    name: 'Tuition — Term 1 | رسوم دراسية',
    quantity: 1,
    unitPrice: 750,
    discount: 0,
    taxCategory: 'S',
    taxPercent: 16,
    taxAmount: 120,
    lineTotal: 870,
  },
];

const ctx = (over: Partial<BuildContext> = {}): BuildContext => ({
  settings: settings(),
  incomeSourceSequence: '425024',
  taxpayerType: 'SALES',
  paymentKind: 'RECEIVABLE',
  lines,
  ...over,
});

describe('fmtAmount', () => {
  it('emits at least 3 decimals (JOD) and trims beyond', () => {
    expect(fmtAmount(750)).toBe('750.000');
    expect(fmtAmount(0.1)).toBe('0.100');
    expect(fmtAmount(1.2345)).toBe('1.2345');
  });
});

describe('invoiceTypeCode (composite name attribute)', () => {
  it.each([
    ['CASH', 'INCOME', '011'],
    ['RECEIVABLE', 'INCOME', '021'],
    ['CASH', 'SALES', '012'],
    ['RECEIVABLE', 'SALES', '022'],
    ['CASH', 'SPECIAL', '013'],
    ['RECEIVABLE', 'SPECIAL', '023'],
  ] as const)('%s + %s → %s', (payment, taxpayer, expected) => {
    const t = invoiceTypeCode({ docType: 'INVOICE', paymentKind: payment } as never, taxpayer);
    expect(t.code).toBe('388');
    expect(t.name).toBe(expected);
  });

  it('credit notes are 381', () => {
    const t = invoiceTypeCode(
      { docType: 'CREDIT_NOTE', paymentKind: 'RECEIVABLE' } as never,
      'SALES',
    );
    expect(t.code).toBe('381');
  });
});

describe('buildJoFotaraXml — sales invoice', () => {
  const xml = buildJoFotaraXml(doc(), ctx());

  it('uses UBL 2.1 Invoice with reporting profile, JOD, and the document identity', () => {
    expect(xml).toContain('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2');
    expect(xml).toContain('<cbc:ProfileID>reporting:1.0</cbc:ProfileID>');
    expect(xml).toContain('<cbc:ID>INV-2026-0001</cbc:ID>');
    expect(xml).toContain('<cbc:UUID>7f1c0a45-9f1e-4d4a-9a8e-0b1c2d3e4f5a</cbc:UUID>');
    expect(xml).toContain('<cbc:IssueDate>2026-06-09</cbc:IssueDate>');
    // Currency-code ELEMENTS are JOD; amount currencyID ATTRIBUTES are "JO" (manual v1.5).
    expect(xml).toContain('<cbc:DocumentCurrencyCode>JOD</cbc:DocumentCurrencyCode>');
    expect(xml).toContain('<cbc:TaxCurrencyCode>JOD</cbc:TaxCurrencyCode>');
    expect(xml).toContain('currencyID="JO"');
    expect(xml).not.toContain('currencyID="JOD"');
  });

  it('marks the type as receivable sales (022) and carries the ICV', () => {
    expect(xml).toContain('<cbc:InvoiceTypeCode name="022">388</cbc:InvoiceTypeCode>');
    expect(xml).toContain('<cbc:ID>ICV</cbc:ID>');
    expect(xml).toContain('<cbc:UUID>7</cbc:UUID>');
  });

  it('carries the seller TIN, Arabic legal name, and income source sequence', () => {
    expect(xml).toContain('<cbc:CompanyID>123456789</cbc:CompanyID>');
    expect(xml).toContain('مدرسة الوادي الأخضر');
    expect(xml).toContain('<cbc:ID>425024</cbc:ID>'); // SellerSupplierParty
  });

  it('carries the buyer (mandatory for receivable) with the NIN scheme', () => {
    expect(xml).toContain('schemeID="NIN"');
    expect(xml).toContain('عمر خالد الحداد');
  });

  it('uses JoFotara tax semantics (S standard) with UN/ECE code lists', () => {
    expect(xml).toContain('schemeID="UN/ECE 5305"');
    expect(xml).toContain('>S</cbc:ID>');
    expect(xml).toContain('<cbc:Percent>16.000</cbc:Percent>');
  });

  it('computes monetary totals with 3+dp amounts', () => {
    expect(xml).toContain(
      '<cbc:TaxExclusiveAmount currencyID="JO">750.000</cbc:TaxExclusiveAmount>',
    );
    expect(xml).toContain(
      '<cbc:TaxInclusiveAmount currencyID="JO">870.000</cbc:TaxInclusiveAmount>',
    );
    expect(xml).toContain('<cbc:PayableAmount currencyID="JO">870.000</cbc:PayableAmount>');
    expect(xml).toContain('<cbc:RoundingAmount currencyID="JO">870.000</cbc:RoundingAmount>');
  });

  it('sanitises slashes in the invoice number', () => {
    const x = buildJoFotaraXml(doc({ invoiceNumber: 'INV/2026/9' }), ctx());
    expect(x).toContain('<cbc:ID>INV_2026_9</cbc:ID>');
  });
});

describe('buildJoFotaraXml — income taxpayer', () => {
  it('omits ALL tax elements (not 0%)', () => {
    const xml = buildJoFotaraXml(
      doc({ taxAmount: 0 as never, payableAmount: 750 as never }),
      ctx({
        taxpayerType: 'INCOME',
        settings: settings({ taxpayerType: 'INCOME', vatEnabled: false }),
      }),
    );
    expect(xml).not.toContain('<cac:TaxTotal>');
    expect(xml).not.toContain('TaxCategory');
    expect(xml).toContain('<cbc:InvoiceTypeCode name="021">388</cbc:InvoiceTypeCode>');
  });
});

describe('buildJoFotaraXml — credit note (381)', () => {
  const xml = buildJoFotaraXml(
    doc({
      docType: 'CREDIT_NOTE',
      creditReason: 'Withdrawal — left school',
      originalDocumentId: 'o1',
    }),
    ctx({
      original: {
        number: 'INV-2026-0001',
        uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        total: 870,
      },
    }),
  );

  it('is a 381 on the Invoice root, referencing the original by ID/UUID/total', () => {
    expect(xml).toContain('>381</cbc:InvoiceTypeCode>');
    expect(xml).toContain('<cac:BillingReference>');
    expect(xml).toContain('<cbc:UUID>aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee</cbc:UUID>');
    expect(xml).toContain('<cbc:DocumentDescription>870.000</cbc:DocumentDescription>');
  });

  it('carries the mandatory return reason as PaymentMeans InstructionNote (code 10)', () => {
    expect(xml).toContain('<cbc:PaymentMeansCode listID="UN/ECE 4461">10</cbc:PaymentMeansCode>');
    expect(xml).toContain('<cbc:InstructionNote>Withdrawal — left school</cbc:InstructionNote>');
  });
});

describe('buildJoFotaraXml — XML safety', () => {
  it('escapes XML-special characters in names', () => {
    const xml = buildJoFotaraXml(
      doc({ buyerName: 'A & B <School>' }),
      ctx({ lines: [{ ...lines[0]!, name: 'Books & Stationery <bundle>' }] }),
    );
    expect(xml).toContain('A &amp; B &lt;School&gt;');
    expect(xml).toContain('Books &amp; Stationery &lt;bundle&gt;');
    expect(xml).not.toContain('<bundle>');
  });
});
