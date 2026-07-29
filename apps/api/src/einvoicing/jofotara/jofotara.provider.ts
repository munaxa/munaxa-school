import { Injectable, Logger } from '@nestjs/common';
import type { EInvoiceDocument } from '@prisma/client';
import type {
  BuildContext,
  ConnectionStatus,
  DecryptedCredentials,
  EInvoiceProvider,
  ProviderResult,
} from '../provider.types';
import { buildJoFotaraXml } from './ubl-builder';

/** The two response shapes JoFotara returns (legacy EINV_* and newer camelCase). */
interface JoFotaraRawResponse {
  EINV_RESULTS?: { status?: string; ERRORS?: unknown[]; WARNINGS?: unknown[]; INFO?: unknown[] };
  EINV_STATUS?: string;
  EINV_QR?: string;
  EINV_INV_UUID?: string;
  EINV_SINGED_INVOICE?: string; // the API's own typo — real field name
  validationResults?: { status?: string; errorMessages?: unknown[]; warningMessages?: unknown[] };
  invoiceStatus?: string;
  qrCode?: string;
  invoiceUUID?: string;
  submittedInvoice?: string;
}

const SUBMIT_TIMEOUT_MS = 50_000; // Odoo's production timeout for this API

/**
 * JoFotara (Jordan / ISTD) adapter — Provider #1 of the e-invoicing framework.
 * Auth = static `Client-Id` / `Secret-Key` headers (no token lifecycle).
 * Request = `{ "invoice": base64(UTF-8 UBL XML) }`.
 * Success = validation PASS AND status ∈ {SUBMITTED, ALREADY_SUBMITTED} —
 * ALREADY_SUBMITTED counts as success so retries are idempotent by UUID.
 */
@Injectable()
export class JoFotaraProvider implements EInvoiceProvider {
  readonly key = 'jofotara';
  readonly defaultEndpoint = 'https://backend.jofotara.gov.jo/core/invoices/';
  private readonly logger = new Logger(JoFotaraProvider.name);

  buildPayload(doc: EInvoiceDocument, ctx: BuildContext): string {
    return buildJoFotaraXml(doc, ctx);
  }

  async submit(
    payload: string,
    creds: DecryptedCredentials,
    endpointUrl: string,
  ): Promise<ProviderResult> {
    let res: Response;
    let bodyText: string;
    try {
      res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Client-Id': creds.clientId,
          'Secret-Key': creds.secret,
          'Content-Type': 'application/json',
        },
        // UTF-8 encode BEFORE base64 — Arabic content corrupts otherwise.
        body: JSON.stringify({ invoice: Buffer.from(payload, 'utf8').toString('base64') }),
        signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
      });
      bodyText = await res.text();
    } catch (e) {
      // Network failure / timeout — transient, the queue retries (UUID makes it safe).
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`JoFotara transport error: ${message}`);
      return { status: 'TRANSIENT_ERROR', errorSummary: `Transport error: ${message}` };
    }

    let parsed: JoFotaraRawResponse = {};
    try {
      parsed = JSON.parse(bodyText) as JoFotaraRawResponse;
    } catch {
      /* non-JSON body handled by status-code fallthrough below */
    }

    if (res.status === 403) {
      // Bad/blocked credentials — not transient; surfaces on the error dashboard.
      return {
        status: 'REJECTED',
        errorSummary: 'Authentication failed (403) — check Client-Id / Secret-Key',
      };
    }
    if (res.status >= 500) {
      return { status: 'TRANSIENT_ERROR', errorSummary: `Provider error (HTTP ${res.status})` };
    }

    return this.parseResult(parsed, res.status);
  }

  /** Normalise both known response shapes into a ProviderResult. */
  parseResult(raw: JoFotaraRawResponse, httpStatus: number): ProviderResult {
    const validationStatus = (raw.EINV_RESULTS?.status ?? raw.validationResults?.status ?? '')
      .toString()
      .toUpperCase();
    const invoiceStatus = (raw.EINV_STATUS ?? raw.invoiceStatus ?? '').toString().toUpperCase();
    const pass = validationStatus === 'PASS';
    const submitted = invoiceStatus === 'SUBMITTED' || invoiceStatus === 'ALREADY_SUBMITTED';

    const common: Pick<
      ProviderResult,
      'externalUuid' | 'qrCode' | 'signedDocument' | 'validationResults'
    > = {
      ...((raw.EINV_INV_UUID ?? raw.invoiceUUID)
        ? { externalUuid: raw.EINV_INV_UUID ?? raw.invoiceUUID }
        : {}),
      ...((raw.EINV_QR ?? raw.qrCode) ? { qrCode: raw.EINV_QR ?? raw.qrCode } : {}),
      ...((raw.EINV_SINGED_INVOICE ?? raw.submittedInvoice)
        ? { signedDocument: raw.EINV_SINGED_INVOICE ?? raw.submittedInvoice }
        : {}),
      validationResults: raw.EINV_RESULTS ?? raw.validationResults ?? raw,
    };

    if (pass && submitted) return { status: 'ACCEPTED', ...common };

    const errors = raw.EINV_RESULTS?.ERRORS ?? raw.validationResults?.errorMessages ?? [];
    const summary =
      Array.isArray(errors) && errors.length > 0
        ? JSON.stringify(errors).slice(0, 1000)
        : `Validation failed (HTTP ${httpStatus}, status=${validationStatus || 'unknown'})`;
    return { status: 'REJECTED', errorSummary: summary, ...common };
  }

  /**
   * JoFotara has no dedicated ping endpoint; an intentionally empty submission with the
   * credentials distinguishes auth failures (403) from reachable-and-authenticated (400).
   */
  async testConnection(
    creds: DecryptedCredentials,
    endpointUrl: string,
  ): Promise<ConnectionStatus> {
    try {
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Client-Id': creds.clientId,
          'Secret-Key': creds.secret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoice: '' }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 403)
        return { ok: false, detail: 'Authentication failed (403) — check Client-Id / Secret-Key' };
      return {
        ok: true,
        detail: `Endpoint reachable and credentials accepted (HTTP ${res.status})`,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, detail: `Cannot reach JoFotara: ${message}` };
    }
  }
}
