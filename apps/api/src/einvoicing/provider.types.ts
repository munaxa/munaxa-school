import type {
  EInvoiceDocument,
  EInvoicePaymentKind,
  EInvoiceSettings,
  EInvoiceTaxpayerType,
} from '@prisma/client';

/** One invoice line, as stored in `EInvoiceDocument.lines` (JSON). Amounts in JOD. */
export interface EInvoiceLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  /** Per-line discount amount (document-level discounts are not allowed by JoFotara). */
  discount: number;
  /** JoFotara semantics: Z = exempt, O = zero-rated, S = standard (reverse of PEPPOL!). */
  taxCategory: 'Z' | 'O' | 'S';
  taxPercent: number;
  taxAmount: number;
  /** Line total including tax (UBL `RoundingAmount`). */
  lineTotal: number;
}

/** Everything a provider adapter needs to build a payload, decoupled from Prisma. */
export interface BuildContext {
  settings: EInvoiceSettings;
  incomeSourceSequence: string;
  taxpayerType: EInvoiceTaxpayerType;
  paymentKind: EInvoicePaymentKind;
  lines: EInvoiceLineItem[];
  /** Original document reference — required when building a credit note (381). */
  original?: { number: string; uuid: string; total: number };
}

/** Decrypted device credentials, only ever materialised inside the submission path. */
export interface DecryptedCredentials {
  clientId: string;
  secret: string;
  incomeSourceSequence: string;
}

export type ProviderSubmitStatus = 'ACCEPTED' | 'REJECTED' | 'TRANSIENT_ERROR';

/** Normalised provider response — the engine never sees provider-specific shapes. */
export interface ProviderResult {
  status: ProviderSubmitStatus;
  /** Provider-side uuid echo, when returned. */
  externalUuid?: string;
  /** QR string to render on the printed invoice (JoFotara returns it; ZATCA computes locally). */
  qrCode?: string;
  /** Provider-signed invoice (base64), retained for the audit archive. */
  signedDocument?: string;
  /** Validation INFO/WARNINGS/ERRORS payload, stored verbatim for the error dashboard. */
  validationResults?: unknown;
  /** Human-readable error summary for `lastError`. */
  errorSummary?: string;
}

export interface ConnectionStatus {
  ok: boolean;
  detail: string;
}

/**
 * The provider adapter contract. Adding a country (ZATCA, ETA, UAE…) means implementing
 * this interface — the engine, queue, document model and finance module are untouched.
 */
export interface EInvoiceProvider {
  readonly key: string;
  /** Build the submission payload (e.g. UBL 2.1 XML) for a document. Pure — no I/O. */
  buildPayload(doc: EInvoiceDocument, ctx: BuildContext): string;
  /** Submit a payload. Must map transport/HTTP failures to TRANSIENT_ERROR, never throw. */
  submit(
    payload: string,
    creds: DecryptedCredentials,
    endpointUrl: string,
  ): Promise<ProviderResult>;
  /** Cheap credential check used by the wizard's "Test connection". */
  testConnection(creds: DecryptedCredentials, endpointUrl: string): Promise<ConnectionStatus>;
  /** The production endpoint used when the tenant has not overridden it. */
  readonly defaultEndpoint: string;
}
