/**
 * Biometric / device provider abstraction (capability N5).
 *
 * Munaxa never integrates with a device SDK or vendor API directly. Every provider — fingerprint,
 * face recognition, RFID, NFC, QR, mobile GPS, a REST webhook or a third-party SDK — implements
 * this port and normalises its payload into {@link NormalisedPunch}. Ingestion then folds punches
 * into staff attendance through the single canonical write path, so adding a vendor never adds a
 * second ingestion route (no vendor lock-in, no duplicate logic).
 */
import type { BiometricPunchDirection, StaffAttendanceSource } from '@prisma/client';

/** The provider families the platform anticipates. Extend by adding an adapter, not a new path. */
export const BiometricProviderKind = {
  FINGERPRINT: 'FINGERPRINT',
  FACE: 'FACE',
  RFID: 'RFID',
  NFC: 'NFC',
  QR: 'QR',
  MOBILE_GPS: 'MOBILE_GPS',
  REST: 'REST',
  SDK: 'SDK',
} as const;
export type BiometricProviderKind =
  (typeof BiometricProviderKind)[keyof typeof BiometricProviderKind];

/** A device event, normalised into platform terms. */
export interface NormalisedPunch {
  /**
   * The provider's own identifier for this event. Combined with the provider key it forms the
   * idempotency key, so redelivering a device event never double-records attendance.
   */
  externalRef: string;
  /** Employee identifier as reported by the device (badge number, finger id, card uid, ...). */
  externalUserRef: string;
  /** Resolved Munaxa employee id, when the adapter can resolve it itself. */
  employeeId?: string | null;
  punchAt: Date;
  direction: BiometricPunchDirection;
  deviceId?: string | null;
  /** Untouched provider payload, retained for audit/debugging. */
  raw?: Record<string, unknown> | null;
}

/**
 * A provider adapter. Implementations are pure translators: they validate and normalise, and must
 * not write to the database or call attendance services themselves.
 */
export interface BiometricProvider {
  /** Stable key identifying this provider (part of the idempotency key). */
  readonly key: string;
  readonly kind: BiometricProviderKind;
  /** The attendance source recorded for punches from this provider. */
  readonly source: StaffAttendanceSource;
  /**
   * Translate a raw provider payload into zero or more normalised punches. Implementations should
   * throw on malformed input; the ingestion service reports the failure per batch.
   */
  normalise(payload: unknown): NormalisedPunch[];
}
