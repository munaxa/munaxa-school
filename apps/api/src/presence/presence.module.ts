import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import {
  AttendanceSettingsController,
  PresenceController,
  TimelineController,
  TransportController,
} from './presence.controller';
import { PresenceService } from './presence.service';
import { PresenceRepository } from './presence.repository';
import {
  IdentificationRegistry,
  ManualProvider,
  NfcProvider,
  QrProvider,
  RfidProvider,
} from './identification/student-identification.provider';

/**
 * Campus Presence + Transportation (Phase 21) — additive domains alongside Academic Attendance.
 * Presence/transport events (offline-queue idempotent on clientRef), the configurable
 * attendance-source engine (guarded non-overwriting PRESENT), the unified student timeline, and
 * the multi-method identification providers (NFC/RFID/QR/MANUAL, Face-ready).
 */
@Module({
  imports: [CardsModule],
  controllers: [
    PresenceController,
    TransportController,
    TimelineController,
    AttendanceSettingsController,
  ],
  providers: [
    PresenceService,
    PresenceRepository,
    ManualProvider,
    QrProvider,
    NfcProvider,
    RfidProvider,
    IdentificationRegistry,
  ],
  exports: [PresenceService],
})
export class PresenceModule {}
