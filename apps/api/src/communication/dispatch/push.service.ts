import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DeliveryResult } from '../queue/channel-job';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** FCM error codes that mean a token is permanently invalid and should be pruned. */
const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

/**
 * Firebase Cloud Messaging push. firebase-admin is imported lazily and only used when configured;
 * otherwise sends are logged (no-op) so the flow works without credentials. Reports invalid tokens
 * so the engine can prune them (token cleanup / rotation).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly configured: boolean;

  constructor(config: ConfigService) {
    this.configured = Boolean(
      config.get('FIREBASE_PROJECT_ID') && config.get('FIREBASE_PRIVATE_KEY'),
    );
  }

  async deliver(tokens: string[], payload: PushPayload): Promise<DeliveryResult> {
    if (tokens.length === 0) {
      return { ok: false, provider: 'fcm', response: { reason: 'no-tokens' } };
    }
    if (!this.configured) {
      this.logger.debug(`[push noop] ${tokens.length} token(s): ${payload.title}`);
      return { ok: true, provider: 'fcm', response: { noop: true, tokens: tokens.length } };
    }
    try {
      const admin = await import('firebase-admin');
      const res = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
      const invalidTokens: string[] = [];
      res.responses.forEach((r, i) => {
        const tok = tokens[i];
        if (tok && !r.success && r.error && INVALID_TOKEN_CODES.has(r.error.code)) {
          invalidTokens.push(tok);
        }
      });
      return {
        ok: res.successCount > 0,
        provider: 'fcm',
        response: { successCount: res.successCount, failureCount: res.failureCount },
        invalidTokens,
      };
    } catch (error) {
      this.logger.warn(`Push send failed: ${String(error)}`);
      return { ok: false, provider: 'fcm', response: { error: String(error) } };
    }
  }

  /** Backward-compatible best-effort fan-out (no result). */
  async sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
    await this.deliver(tokens, payload);
  }
}
