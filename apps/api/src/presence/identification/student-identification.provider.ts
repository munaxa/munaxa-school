import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../../common/tenant.repository';
import { CardsService } from '../../cards/cards.service';

/**
 * Resolves a physical identifier (NFC card UID, RFID tag, QR payload, or a manual selection)
 * into a Munaxa studentId. The presence/transport engine depends only on this interface, never on
 * a specific capture method — so NFC/RFID/QR/Manual (and a future Face provider) are interchangeable.
 */
export interface StudentIdentificationProvider {
  readonly method: string;
  /** Return the studentId for the given identifier, or null if it cannot be resolved. */
  resolve(identifier: string): Promise<string | null>;
}

/** MANUAL: the identifier IS the studentId (the attendant tapped a name in the app). */
@Injectable()
export class ManualProvider implements StudentIdentificationProvider {
  readonly method = 'MANUAL';
  resolve(identifier: string): Promise<string | null> {
    return Promise.resolve(identifier || null);
  }
}

/** QR: resolve the student's printed QR code (Student.qrCode) to its id. */
@Injectable()
export class QrProvider extends TenantRepository implements StudentIdentificationProvider {
  readonly method = 'QR';
  resolve(identifier: string): Promise<string | null> {
    return this.run(async (tx) => {
      const s = await tx.student.findFirst({
        where: { qrCode: identifier, deletedAt: null },
        select: { id: true },
      });
      return s?.id ?? null;
    });
  }
}

/**
 * NFC / RFID: resolve the physical card UID → studentId via the StudentCard registry (Phase 22),
 * but ONLY when the card is ACTIVE — a SUSPENDED/STOLEN/LOST/REVOKED card resolves to null so it
 * can no longer be used to capture events.
 */
@Injectable()
export class NfcProvider implements StudentIdentificationProvider {
  readonly method = 'NFC';
  constructor(private readonly cards: CardsService) {}
  resolve(identifier: string): Promise<string | null> {
    return identifier ? this.cards.resolveActive(identifier, 'NFC') : Promise.resolve(null);
  }
}

@Injectable()
export class RfidProvider implements StudentIdentificationProvider {
  readonly method = 'RFID';
  constructor(private readonly cards: CardsService) {}
  resolve(identifier: string): Promise<string | null> {
    return identifier ? this.cards.resolveActive(identifier, 'RFID') : Promise.resolve(null);
  }
}

/** Registry: pick a provider by capture method. */
@Injectable()
export class IdentificationRegistry {
  private readonly providers: Map<string, StudentIdentificationProvider>;

  constructor(manual: ManualProvider, qr: QrProvider, nfc: NfcProvider, rfid: RfidProvider) {
    this.providers = new Map([manual, qr, nfc, rfid].map((p) => [p.method, p] as const));
  }

  get(method: string): StudentIdentificationProvider | undefined {
    return this.providers.get(method);
  }
}
