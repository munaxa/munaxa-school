import { describe, it, expect } from 'vitest';
import { classroomLabel } from './classroom.js';
import { Locale } from './locale.js';

const grade = { nameEn: 'Grade 6', nameAr: 'الصف السادس', level: 6 };

describe('classroomLabel', () => {
  it('names a classroom by its grade and its section', () => {
    expect(classroomLabel({ name: 'B', grade })).toBe('Grade 6 · B');
  });

  it('uses the Arabic grade name in Arabic', () => {
    expect(classroomLabel({ name: 'ب', grade }, Locale.AR)).toBe('الصف السادس · ب');
  });

  it('falls back to the section name when the grade is missing', () => {
    expect(classroomLabel({ name: 'B' })).toBe('B');
    expect(classroomLabel({ name: 'B', grade: null })).toBe('B');
    expect(classroomLabel({ name: 'B', grade: { nameEn: '', nameAr: '' } })).toBe('B');
  });
});
