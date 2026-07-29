/**
 * Mocked external integrations. NONE of these touch the network — the CSP also blocks
 * outbound connections. Each returns a fake "MOCKED" result and is meant to be recorded
 * in the in-memory Outbox so the demo can SHOW the action happening without it happening.
 *
 * Covers: email, SMS, WhatsApp, push, JoFotara e-invoicing, and payment gateways.
 */
import type { OutboxMessage } from '@/seed/types';

export type Channel = OutboxMessage['channel'];

export interface MockResult {
  status: 'MOCKED';
  channel: Channel;
  to: string;
  summary: string;
  reference: string;
}

function ref(prefix: string): string {
  return `${prefix}-${Math.floor(Math.random() * 1e9)
    .toString(36)
    .toUpperCase()}`;
}

function make(channel: Channel, to: string, summary: string, prefix: string): MockResult {
  // Intentionally a pure, local, side-effect-free stub.
  return { status: 'MOCKED', channel, to, summary, reference: ref(prefix) };
}

export const mockIntegrations = {
  email: (to: string, subject: string) => make('EMAIL', to, subject, 'EML'),
  sms: (to: string, text: string) => make('SMS', to, text, 'SMS'),
  whatsapp: (to: string, text: string) => make('WHATSAPP', to, text, 'WA'),
  push: (to: string, text: string) => make('PUSH', to, text, 'PSH'),
  /** JoFotara (Jordan national e-invoicing) — never submitted; returns a fake UUID. */
  jofotara: (invoiceNumber: string) =>
    make('JOFOTARA', invoiceNumber, `e-Invoice cleared (sandbox) for ${invoiceNumber}`, 'JOF'),
  /** Payment gateway — never charges; returns a fake authorization. */
  payment: (amountLabel: string, method: string) =>
    make('PAYMENT', method, `Authorized ${amountLabel} via ${method} (no real charge)`, 'PAY'),
};
