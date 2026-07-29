import { Global, Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';

/**
 * Outbound webhook framework. Global so any lifecycle code (subscription/billing/trial) can inject
 * {@link WebhookService} to publish events to external integrations without re-importing.
 */
@Global()
@Module({
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhooksModule {}
