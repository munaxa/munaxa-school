import { describe, it, expect } from 'vitest';
import {
  isValidJordanianNationalId,
  isValidJordanianMobile,
  normalizeJordanianMobile,
  isValidMoeStudentNumber,
} from './jordan.js';

describe('Jordanian National ID', () => {
  it('accepts a 10-digit id', () => {
    expect(isValidJordanianNationalId('9991234567')).toBe(true);
  });
  it('rejects non-10-digit input', () => {
    expect(isValidJordanianNationalId('123')).toBe(false);
    expect(isValidJordanianNationalId('abcdefghij')).toBe(false);
  });
});

describe('Jordanian mobile', () => {
  it('accepts local and international formats', () => {
    expect(isValidJordanianMobile('0791234567')).toBe(true);
    expect(isValidJordanianMobile('+962791234567')).toBe(true);
  });
  it('normalizes to E.164', () => {
    expect(normalizeJordanianMobile('0791234567')).toBe('+962791234567');
    expect(normalizeJordanianMobile('invalid')).toBeNull();
  });
});

describe('MoE student number', () => {
  it('accepts 6-15 digit numbers', () => {
    expect(isValidMoeStudentNumber('123456')).toBe(true);
    expect(isValidMoeStudentNumber('12')).toBe(false);
  });
});
