import { createHmac, randomBytes } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma, WebhookEndpoint } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withPlatform } from '../prisma/tenant.helpers';

/** The catalog of platform webhook event types (external integrations subscribe to these). */
export const WebhookEvent = {
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  TRIAL_STARTED: 'trial.started',
  TRIAL_EXPIRED: 'trial.expired',
  UPGRADE_REQUESTED: 'upgrade.requested',
  UPGRADE_APPROVED: 'upgrade.approved',
  COUPON_USED: 'coupon.used',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_COMPLETED: 'payment.completed',
  SCHOOL_CREATED: 'school.created',
  SCHOOL_DELETED: 'school.deleted',
} as const;
export type WebhookEvent = (typeof WebhookEvent)[keyof typeof WebhookEvent];

export interface PublishOptions {
  /** The school the event concerns (null/undefined = a platform-level event). */
  tenantId?: string | null;
  data: Record<string, unknown>;
}

/**
 * Outbound webhook framework. Business/lifecycle code calls {@link publish} with an event type;
 * matching active endpoints (the tenant's own + platform-global) each get a {@link WebhookDelivery}
 * record and a best-effort signed HTTP POST. Delivery never blocks or breaks the caller — failures
 * are recorded on the delivery row for retry/inspection, not thrown.
 *
 * Designed for future CRM / accounting / analytics / automation integrations.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Which endpoints should receive an event: active, and subscribed to it (empty list = all). */
  static matchEndpoints(endpoints: WebhookEndpoint[], eventType: string): WebhookEndpoint[] {
    return endpoints.filter(
      (e) => e.isActive && (e.eventTypes.length === 0 || e.eventTypes.includes(eventType)),
    );
  }

  /** Record + dispatch an event to all matching endpoints. Fire-and-forget for the HTTP send. */
  async publish(eventType: string, opts: PublishOptions): Promise<void> {
    const endpoints = await withPlatform(this.prisma, (tx) =>
      tx.webhookEndpoint.findMany({
        where: {
          isActive: true,
          OR: [{ tenantId: opts.tenantId ?? null }, { tenantId: null }],
        },
      }),
    );
    const targets = WebhookService.matchEndpoints(endpoints, eventType);
    if (targets.length === 0) return;

    const payload = {
      event: eventType,
      tenantId: opts.tenantId ?? null,
      data: opts.data,
      at: new Date().toISOString(),
    };

    await Promise.all(
      targets.map(async (endpoint) => {
        const delivery = await withPlatform(this.prisma, (tx) =>
          tx.webhookDelivery.create({
            data: {
              endpointId: endpoint.id,
              eventType,
              payload: payload as unknown as Prisma.InputJsonValue,
              status: 'PENDING',
            },
          }),
        );
        // Send without blocking the caller; the result is recorded on the delivery row.
        void this.dispatch(endpoint, delivery.id, payload);
      }),
    );
  }

  /** Best-effort HTTP delivery with an optional HMAC-SHA256 signature; records the outcome. */
  private async dispatch(
    endpoint: WebhookEndpoint,
    deliveryId: string,
    payload: unknown,
  ): Promise<void> {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (endpoint.secret) {
      headers['x-munaxa-signature'] = createHmac('sha256', endpoint.secret)
        .update(body)
        .digest('hex');
    }
    try {
      const res = await fetch(endpoint.url, { method: 'POST', headers, body });
      await this.record(
        deliveryId,
        res.ok ? 'DELIVERED' : 'FAILED',
        res.status,
        res.ok ? null : `HTTP ${res.status}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'delivery error';
      this.logger.warn(`Webhook ${endpoint.id} delivery failed: ${message}`);
      await this.record(deliveryId, 'FAILED', null, message).catch(() => undefined);
    }
  }

  private record(
    deliveryId: string,
    status: 'DELIVERED' | 'FAILED',
    responseStatus: number | null,
    lastError: string | null,
  ): Promise<unknown> {
    return withPlatform(this.prisma, (tx) =>
      tx.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status,
          responseStatus,
          lastError,
          attempts: { increment: 1 },
          ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        },
      }),
    );
  }

  // --- Platform console management -------------------------------------------

  listEndpoints() {
    return withPlatform(this.prisma, (tx) =>
      tx.webhookEndpoint.findMany({ orderBy: { createdAt: 'desc' } }),
    );
  }

  createEndpoint(data: Prisma.WebhookEndpointUncheckedCreateInput) {
    return withPlatform(this.prisma, (tx) => tx.webhookEndpoint.create({ data }));
  }

  deleteEndpoint(id: string) {
    return withPlatform(this.prisma, (tx) =>
      tx.webhookDelivery
        .deleteMany({ where: { endpointId: id } })
        .then(() => tx.webhookEndpoint.delete({ where: { id } })),
    );
  }

  /** Enable or disable an endpoint (disabled endpoints receive no deliveries). */
  setEndpointActive(id: string, isActive: boolean) {
    return withPlatform(this.prisma, (tx) =>
      tx.webhookEndpoint.update({ where: { id }, data: { isActive } }),
    );
  }

  /** Generate and store a new signing secret; returns the endpoint with the new secret. */
  rotateSecret(id: string) {
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    return withPlatform(this.prisma, (tx) =>
      tx.webhookEndpoint.update({ where: { id }, data: { secret } }),
    );
  }

  listDeliveries(endpointId: string, onlyFailed = false) {
    return withPlatform(this.prisma, (tx) =>
      tx.webhookDelivery.findMany({
        where: { endpointId, ...(onlyFailed ? { status: 'FAILED' } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  /** Re-attempt a failed/pending delivery using its stored payload. */
  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = await withPlatform(this.prisma, (tx) =>
      tx.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { endpoint: true } }),
    );
    if (!delivery) throw new NotFoundException('Delivery not found');
    await this.dispatch(delivery.endpoint, delivery.id, delivery.payload);
  }
}
