import { Global, Module } from '@nestjs/common';
import { DomainEvents } from './domain-events';

/**
 * Global domain-event bus. Any business module can inject {@link DomainEvents} to publish facts
 * (StudentCreated, CampusCreated, …) without importing consumer logic. Consumers (usage tracking,
 * webhooks) subscribe on their own module init.
 */
@Global()
@Module({
  providers: [DomainEvents],
  exports: [DomainEvents],
})
export class EventsModule {}
