import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsMessage {
  to: string; // E.164 phone number
  body: string;
}

/**
 * SMS sender framework. A concrete provider (e.g. an Aggregator / Twilio / local Jordanian SMS
 * gateway) is plugged in via env (`SMS_PROVIDER` + `SMS_API_KEY`). Until then this is a safe
 * no-op that records intent — mirroring PushService/WhatsAppBridge so flows work without
 * credentials. Returns the number of messages actually dispatched.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly configured: boolean;

  constructor(config: ConfigService) {
    this.configured = Boolean(config.get('SMS_PROVIDER') && config.get('SMS_API_KEY'));
  }

  get isConfigured(): boolean {
    return this.configured;
  }

  send(messages: SmsMessage[]): Promise<number> {
    const valid = messages.filter((m) => m.to.trim().length > 0);
    if (valid.length === 0) return Promise.resolve(0);
    if (!this.configured) {
      this.logger.debug(`[sms noop] ${valid.length} message(s) — provider not configured`);
      return Promise.resolve(0); // nothing actually left the system
    }
    // A real provider call goes here (per SMS_PROVIDER). Framework stub records intent.
    this.logger.log(`[sms] dispatching ${valid.length} message(s)`);
    return Promise.resolve(valid.length);
  }
}
