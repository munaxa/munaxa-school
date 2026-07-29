import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingRepository } from './billing.repository';

/**
 * Platform billing domain (Munaxa → school): invoices, payments, refunds, payment methods, billing
 * contacts and tax. Separated from the Platform Console + Subscription planes so entitlement
 * resolution and commercial billing stay independent. Depends on the global WebhooksModule.
 */
@Module({
  controllers: [BillingController],
  providers: [BillingService, BillingRepository],
  exports: [BillingService],
})
export class BillingModule {}
