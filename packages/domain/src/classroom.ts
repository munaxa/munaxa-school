/**
 * Classroom naming.
 *
 * In Munaxa a **classroom is a group of students, not a room**: students stay where they are and
 * the teacher comes to them. A classroom is therefore identified by the grade it belongs to plus
 * its section letter — "Grade 6 · B" — and it is the `Section` record that carries that identity.
 *
 * The physical space a classroom occupies is a **room** (the historically-named `Classroom` table,
 * surfaced in the UI as "Rooms"). A classroom optionally points at one; timetabled lessons with no
 * location of their own happen in it.
 */

import { DEFAULT_LOCALE, Locale } from './locale.js';

/** The parent grade of a classroom, as returned alongside a section by the sections endpoint. */
export interface ClassroomGradeRef {
  nameEn: string;
  nameAr: string;
  level?: number;
}

/** A section, i.e. a classroom, in the shape every caller already has on hand. */
export interface ClassroomRef {
  /** Section letter or short name, e.g. "B". */
  name: string;
  grade?: ClassroomGradeRef | null;
}

/** Separator between the grade name and the section letter. */
export const CLASSROOM_SEPARATOR = ' · ';

/**
 * The canonical display name of a classroom — "Grade 6 · B" in English, "الصف السادس · ب" in
 * Arabic. Falls back to the bare section name when the parent grade was not loaded, so a caller
 * with a partial record still renders something meaningful.
 */
export function classroomLabel(section: ClassroomRef, locale: Locale = DEFAULT_LOCALE): string {
  const grade = section.grade;
  if (!grade) return section.name;
  const gradeName = locale === Locale.AR ? grade.nameAr : grade.nameEn;
  if (!gradeName) return section.name;
  return `${gradeName}${CLASSROOM_SEPARATOR}${section.name}`;
}
