import type { WebhookEndpoint } from '@prisma/client';
import { WebhookService } from './webhook.service';

function endpoint(overrides: Partial<WebhookEndpoint>): WebhookEndpoint {
  return {
    id: overrides.id ?? 'e1',
    tenantId: overrides.tenantId ?? null,
    url: overrides.url ?? 'https://example.test/hook',
    description: null,
    eventTypes: overrides.eventTypes ?? [],
    secret: overrides.secret ?? null,
    isActive: overrides.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('WebhookService.matchEndpoints', () => {
  it('delivers to endpoints subscribed to the event', () => {
    const eps = [
      endpoint({ id: 'a', eventTypes: ['subscription.updated'] }),
      endpoint({ id: 'b', eventTypes: ['payment.failed'] }),
    ];
    const matched = WebhookService.matchEndpoints(eps, 'subscription.updated');
    expect(matched.map((e) => e.id)).toEqual(['a']);
  });

  it('treats an empty eventTypes list as "all events"', () => {
    const eps = [endpoint({ id: 'all', eventTypes: [] })];
    expect(WebhookService.matchEndpoints(eps, 'anything').map((e) => e.id)).toEqual(['all']);
  });

  it('skips inactive endpoints', () => {
    const eps = [endpoint({ id: 'off', isActive: false, eventTypes: [] })];
    expect(WebhookService.matchEndpoints(eps, 'subscription.updated')).toEqual([]);
  });
});
