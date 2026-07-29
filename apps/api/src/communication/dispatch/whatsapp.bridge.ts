import { Injectable, Logger } from '@nestjs/common';
import { FeatureFlagService } from '../feature-flags/feature-flag.service';

/** Feature-flag key controlling the WhatsApp bridge (disabled by default per tenant). */
export const WHATSAPP_FLAG = 'whatsapp_bridge';

export interface BridgeMessage {
  title: string;
  body: string;
}

/**
 * WhatsApp bridge framework. Outbound WhatsApp messaging is gated behind the per-tenant
 * `whatsapp_bridge` feature flag and is OFF by default. A concrete provider (e.g. WhatsApp
 * Business API) is plugged in here; until then this is a safe no-op that records intent.
 */
@Injectable()
export class WhatsAppBridge {
  private readonly logger = new Logger(WhatsAppBridge.name);

  constructor(private readonly flags: FeatureFlagService) {}

  /** Send only if the tenant has enabled the WhatsApp bridge flag. Returns whether it dispatched. */
  async notify(message: BridgeMessage): Promise<boolean> {
    const enabled = await this.flags.isEnabled(WHATSAPP_FLAG);
    if (!enabled) return false;
    // A real provider call goes here. Framework stub: record intent.
    this.logger.log(`[whatsapp] dispatch: ${message.title}`);
    return true;
  }
}
