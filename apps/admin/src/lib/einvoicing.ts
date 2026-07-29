'use client';

import { authFetch } from './auth';

export type EInvoiceEnvironment = 'SIMULATION' | 'PRODUCTION';
export type EInvoiceTaxpayerType = 'INCOME' | 'SALES' | 'SPECIAL';
export type EInvoicePaymentKind = 'CASH' | 'RECEIVABLE';
export type EInvoiceDocStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'SUBMITTING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'DEAD_LETTER'
  | 'CANCELLED';

export interface EInvoiceSettings {
  enabled: boolean;
  environment: EInvoiceEnvironment;
  endpointUrl: string | null;
  legalNameEn: string | null;
  legalNameAr: string | null;
  taxNumber: string | null;
  vatNumber: string | null;
  commercialRegistration: string | null;
  addressLine: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  taxpayerType: EInvoiceTaxpayerType;
  vatEnabled: boolean;
  vatPercent: string | number | null;
  defaultTaxCategory: string;
  defaultPaymentKind: EInvoicePaymentKind;
  autoIssueOnCharge: boolean;
  autoCreditOnAdjustment: boolean;
  completedSteps: number;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  credential: { clientId: string; secretHint: string; incomeSourceSequence: string } | null;
}

export interface EInvoiceDocument {
  id: string;
  docType: 'INVOICE' | 'CREDIT_NOTE';
  paymentKind: EInvoicePaymentKind;
  status: EInvoiceDocStatus;
  invoiceNumber: string;
  uuid: string;
  icv: string | null;
  buyerName: string | null;
  payableAmount: string;
  taxAmount: string;
  qrCode: string | null;
  lastError: string | null;
  attempts: number;
  createdAt: string;
  acceptedAt: string | null;
}

export interface EInvoiceDashboard {
  today: number;
  thisMonth: number;
  byStatus: Partial<Record<EInvoiceDocStatus, number>>;
  lastAcceptedAt: string | null;
  lastError: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

const base = '/einvoicing';

export const einvoicingApi = {
  settings: () => authFetch(`${base}/settings`).then((r) => json<EInvoiceSettings>(r)),
  updateSettings: (
    data: Partial<Omit<EInvoiceSettings, 'credential' | 'lastTestAt' | 'lastTestOk'>>,
  ) =>
    authFetch(`${base}/settings`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<EInvoiceSettings>(r),
    ),
  saveCredentials: (data: {
    clientId: string;
    secret: string;
    incomeSourceSequence: string;
    deviceLabel?: string;
  }) =>
    authFetch(`${base}/credentials`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<{ clientId: string; secretHint: string }>(r),
    ),
  testConnection: () =>
    authFetch(`${base}/test-connection`, { method: 'POST' }).then((r) =>
      json<{ ok: boolean; detail: string }>(r),
    ),
  dashboard: () => authFetch(`${base}/dashboard`).then((r) => json<EInvoiceDashboard>(r)),
  documents: (status?: EInvoiceDocStatus) =>
    authFetch(`${base}/documents${status ? `?status=${status}` : ''}`).then((r) =>
      json<EInvoiceDocument[]>(r),
    ),
  createInvoice: (data: {
    invoiceNumber: string;
    paymentKind?: EInvoicePaymentKind;
    buyerName?: string;
    buyerIdScheme?: 'TN' | 'NIN' | 'PN';
    buyerIdValue?: string;
    lines: Array<{ name: string; quantity: number; unitPrice: number; discount?: number }>;
  }) =>
    authFetch(`${base}/invoices`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<EInvoiceDocument>(r),
    ),
  queue: (id: string) =>
    authFetch(`${base}/documents/${id}/queue`, { method: 'POST' }).then((r) =>
      json<EInvoiceDocument>(r),
    ),
  requeue: (id: string) =>
    authFetch(`${base}/documents/${id}/requeue`, { method: 'POST' }).then((r) =>
      json<EInvoiceDocument>(r),
    ),
  runQueue: () =>
    authFetch(`${base}/queue/run`, { method: 'POST' }).then((r) => json<{ processed: number }>(r)),
  issueFromCharge: (chargeId: string) =>
    authFetch(`${base}/from-charge/${chargeId}`, { method: 'POST' }).then((r) =>
      json<EInvoiceDocument>(r),
    ),
  creditFromCharge: (chargeId: string, amount: number, reason: string) =>
    authFetch(`${base}/credit-from-charge/${chargeId}`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    }).then((r) => json<EInvoiceDocument>(r)),
};
