/** A fully-resolved single-channel delivery job placed on the queue by the engine. */
export interface ChannelJob {
  tenantId: string;
  notificationId: string;
  deliveryId: string;
  channel: 'PUSH' | 'EMAIL';
  /** FCM tokens (push). */
  tokens?: string[];
  /** Recipient address (email). */
  email?: string;
  title: string;
  body: string;
  language: 'en' | 'ar';
  data?: Record<string, string>;
}

/** Result of attempting one channel send. */
export interface DeliveryResult {
  ok: boolean;
  provider: string;
  response?: Record<string, unknown>;
  /** Tokens FCM reported as invalid — pruned by the engine. */
  invalidTokens?: string[];
}
