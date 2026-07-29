import type { EInvoiceDocument } from '@prisma/client';
import type { BuildContext, EInvoiceLineItem } from '../provider.types';

/**
 * JoFotara UBL 2.1 invoice builder (pure — no I/O). Encodes the ISTD rules from
 * docs/integrations/jofotara/01-compliance-analysis.md:
 *
 * - UBL 2.1 `Invoice` root for BOTH invoices (388) and credit notes (381).
 * - `InvoiceTypeCode/@name` is the 3-digit composite `scope+payment+taxpayer`
 *   (local=0; cash=1/receivable=2; income=1/sales=2/special=3) → 011/021/012/022/013/023.
 * - Currency: the `DocumentCurrencyCode`/`TaxCurrencyCode` ELEMENTS are "JOD", but every monetary
 *   amount's `currencyID` ATTRIBUTE is "JO" — per the official ISTD Technical Linking Guide v1.5
 *   (2026-05-12), which is explicit and repeated (e.g. `<cbc:TaxAmount currencyID="JO">4.480`).
 *   (Some production integrations emit "JOD" here; the official manual is the source of truth.)
 *   Amounts use ≥3 and ≤9 decimals so line sums equal totals.
 * - ICV counter in `AdditionalDocumentReference`.
 * - Tax categories use JoFotara semantics: Z=exempt, O=zero-rated, S=standard
 *   (the REVERSE of PEPPOL/ZATCA — do not "fix" this).
 * - INCOME taxpayers omit ALL tax elements (not 0%).
 * - Credit notes carry BillingReference (original ID/UUID/total), PaymentMeans code 10
 *   and a mandatory InstructionNote (return reason).
 * - Discounts are per-line only (document-level discounts are rejected by JoFotara).
 */

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** ≥3 dp (JOD), ≤9 dp, no scientific notation, no trailing-zero bloat beyond 3 dp. */
export const fmtAmount = (n: number): string => {
  const fixed = n.toFixed(9);
  const trimmed = fixed.replace(/(\.\d{3,}?)0+$/, '$1');
  return trimmed;
};

const PAYMENT_DIGIT = { CASH: '1', RECEIVABLE: '2' } as const;
const TAXPAYER_DIGIT = { INCOME: '1', SALES: '2', SPECIAL: '3' } as const;

/** 388 invoice / 381 return + the composite name attribute, local scope (0). */
export function invoiceTypeCode(
  doc: Pick<EInvoiceDocument, 'docType' | 'paymentKind'>,
  taxpayer: keyof typeof TAXPAYER_DIGIT,
): { code: '388' | '381'; name: string } {
  return {
    code: doc.docType === 'CREDIT_NOTE' ? '381' : '388',
    name: `0${PAYMENT_DIGIT[doc.paymentKind]}${TAXPAYER_DIGIT[taxpayer]}`,
  };
}

function lineXml(line: EInvoiceLineItem, index: number, withTax: boolean): string {
  const gross = line.quantity * line.unitPrice;
  const lineExtension = gross - line.discount;
  const taxBlock = withTax
    ? `
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="JO">${fmtAmount(line.taxAmount)}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="JO">${fmtAmount(line.lineTotal)}</cbc:RoundingAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="JO">${fmtAmount(lineExtension)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="JO">${fmtAmount(line.taxAmount)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">${line.taxCategory}</cbc:ID>
            <cbc:Percent>${fmtAmount(line.taxPercent)}</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>`
    : '';
  return `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${fmtAmount(line.quantity)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="JO">${fmtAmount(lineExtension)}</cbc:LineExtensionAmount>${taxBlock}
      <cac:Item>
        <cbc:Name>${esc(line.name)}</cbc:Name>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="JO">${fmtAmount(line.unitPrice)}</cbc:PriceAmount>
        <cac:AllowanceCharge>
          <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
          <cbc:AllowanceChargeReason>DISCOUNT</cbc:AllowanceChargeReason>
          <cbc:Amount currencyID="JO">${fmtAmount(line.discount)}</cbc:Amount>
        </cac:AllowanceCharge>
      </cac:Price>
    </cac:InvoiceLine>`;
}

export function buildJoFotaraXml(doc: EInvoiceDocument, ctx: BuildContext): string {
  const s = ctx.settings;
  const tin = (s.taxNumber ?? '').replace(/\D/g, '');
  const invoiceId = doc.invoiceNumber.replace(/\//g, '_');
  const type = invoiceTypeCode(doc, ctx.taxpayerType);
  const withTax = ctx.taxpayerType !== 'INCOME';
  const issueDate = (doc.issuedAt ?? doc.createdAt).toISOString().slice(0, 10);

  const sellerName = s.legalNameAr ?? s.legalNameEn ?? '';
  const taxExclusive = Number(doc.taxExclusive);
  const taxAmount = Number(doc.taxAmount);
  const discountTotal = Number(doc.discountTotal);
  const payable = Number(doc.payableAmount);
  const taxInclusive = taxExclusive - discountTotal + taxAmount;

  const buyerBlock =
    doc.buyerName || doc.buyerIdValue
      ? `
  <cac:AccountingCustomerParty>
    <cac:Party>${
      doc.buyerIdValue
        ? `
      <cac:PartyIdentification>
        <cbc:ID schemeID="${esc(doc.buyerIdScheme ?? 'NIN')}">${esc(doc.buyerIdValue)}</cbc:ID>
      </cac:PartyIdentification>`
        : ''
    }${
      doc.buyerCity
        ? `
      <cac:PostalAddress>
        <cbc:CountrySubentityCode>${esc(doc.buyerCity)}</cbc:CountrySubentityCode>
        <cac:Country><cbc:IdentificationCode>JO</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>`
        : ''
    }
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(doc.buyerName ?? '')}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>${
      doc.buyerPhone
        ? `
    <cac:AccountingContact><cbc:Telephone>${esc(doc.buyerPhone)}</cbc:Telephone></cac:AccountingContact>`
        : ''
    }
  </cac:AccountingCustomerParty>`
      : '';

  const creditBlocks =
    doc.docType === 'CREDIT_NOTE'
      ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(ctx.original?.number ?? '')}</cbc:ID>
      <cbc:UUID>${esc(ctx.original?.uuid ?? '')}</cbc:UUID>
      <cbc:DocumentDescription>${fmtAmount(ctx.original?.total ?? payable)}</cbc:DocumentDescription>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode listID="UN/ECE 4461">10</cbc:PaymentMeansCode>
    <cbc:InstructionNote>${esc(doc.creditReason ?? '')}</cbc:InstructionNote>
  </cac:PaymentMeans>`
      : '';

  const docTaxTotal = withTax
    ? `
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="JO">${fmtAmount(taxAmount)}</cbc:TaxAmount>
  </cac:TaxTotal>`
    : '';

  const lines = ctx.lines.map((l, i) => lineXml(l, i, withTax)).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${esc(invoiceId)}</cbc:ID>
  <cbc:UUID>${doc.uuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:InvoiceTypeCode name="${type.name}">${type.code}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>JOD</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>JOD</cbc:TaxCurrencyCode>${creditBlocks}
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${doc.icv ?? 1}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PostalAddress>
        <cac:Country><cbc:IdentificationCode>JO</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(tin)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(sellerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>${buyerBlock}
  <cac:SellerSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID>${esc(ctx.incomeSourceSequence)}</cbc:ID>
      </cac:PartyIdentification>
    </cac:Party>
  </cac:SellerSupplierParty>${docTaxTotal}
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="JO">${fmtAmount(taxExclusive)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="JO">${fmtAmount(taxInclusive)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="JO">${fmtAmount(discountTotal)}</cbc:AllowanceTotalAmount>${
      doc.docType === 'CREDIT_NOTE'
        ? `
    <cbc:PrepaidAmount currencyID="JO">${fmtAmount(taxInclusive)}</cbc:PrepaidAmount>`
        : ''
    }
    <cbc:PayableAmount currencyID="JO">${fmtAmount(payable)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lines}
</Invoice>`;
}
