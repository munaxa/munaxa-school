import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { CardsRepository } from './cards.repository';

/**
 * Student NFC/RFID card registry (Phase 22). Exported so the presence/transport identification
 * providers can resolve a card UID → studentId (ACTIVE cards only).
 */
@Module({
  controllers: [CardsController],
  providers: [CardsService, CardsRepository],
  exports: [CardsService],
})
export class CardsModule {}
