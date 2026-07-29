/**
 * Jordan-specific validation helpers (Raqam Watani / National ID, MoE student number,
 * phone, CliQ reference). These are foundation utilities; business rules that consume them
 * are implemented in their respective phases.
 *
 * NOTE: The Jordanian National ID is a 10-digit number. The precise official checksum
 * algorithm is not publicly standardized; we validate structure here and expose a hook
 * (`isValidNationalIdChecksum`) to be tightened in Phase 5 once the confirmed spec is wired in.
 */

/** Jordanian National ID (Raqam Watani): exactly 10 digits. */
export function isValidJordanianNationalId(value: string): boolean {
  return /^\d{10}$/.test(value.trim());
}

/** Placeholder checksum hook — structural validation only for now (see note above). */
export function isValidNationalIdChecksum(value: string): boolean {
  return isValidJordanianNationalId(value);
}

/** Ministry of Education student number: digits, length tolerated 6–15 (tightened in Phase 5). */
export function isValidMoeStudentNumber(value: string): boolean {
  return /^\d{6,15}$/.test(value.trim());
}

/**
 * Jordanian mobile number. Accepts local (07XXXXXXXX) or international (+9627XXXXXXXX).
 * Returns true for valid Jordanian mobile formats.
 */
export function isValidJordanianMobile(value: string): boolean {
  const v = value.replace(/[\s-]/g, '');
  return /^(?:\+962|00962|0)7[789]\d{7}$/.test(v);
}

/** Normalize a Jordanian mobile number to E.164 (+9627XXXXXXXX). Returns null if invalid. */
export function normalizeJordanianMobile(value: string): string | null {
  if (!isValidJordanianMobile(value)) return null;
  const digits = value.replace(/[\s-]/g, '').replace(/^(\+962|00962|0)/, '');
  return `+962${digits}`;
}

/** CliQ alias/reference — alphanumeric, 3–34 chars (bank IBAN/alias style). */
export function isValidCliqReference(value: string): boolean {
  return /^[A-Za-z0-9.]{3,34}$/.test(value.trim());
}
