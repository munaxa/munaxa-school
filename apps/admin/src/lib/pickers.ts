'use client';

import type { PickerOption } from '@munaxa/ui';
import { Locale, classroomLabel } from '@school/domain';
import { fullNameAr, fullNameEn, parentsApi, studentsApi } from './people';
import { sectionsApi } from './structure';

/** Module-level (stable) loaders so they can be passed straight to <EntityPicker load={…} />. */

export async function loadStudentOptions(): Promise<PickerOption[]> {
  const students = await studentsApi.list();
  return students.map((s) => ({
    id: s.id,
    // Full name (given · father · grandfather · family) so search matches any name part.
    label: fullNameEn(s) || fullNameAr(s) || s.qrCode,
    // Arabic full name in the sublabel keeps it searchable in Arabic too.
    sublabel: `${fullNameAr(s)} · ${s.nationalId ?? s.qrCode}`,
  }));
}

export async function loadParentOptions(): Promise<PickerOption[]> {
  const parents = await parentsApi.list();
  return parents.map((p) => ({
    id: p.id,
    label: `${p.firstNameEn} ${p.lastNameEn}`,
    sublabel: `${p.firstNameAr} ${p.lastNameAr}${p.phone ? ` · ${p.phone}` : ''}`,
  }));
}

/** Classrooms — a grade plus a section, e.g. "Grade 6 · B" (see `classroomLabel`). */
export async function loadSectionOptions(): Promise<PickerOption[]> {
  const sections = await sectionsApi.list();
  return sections.map((s) => ({
    id: s.id,
    // The grade prefix is what makes the classroom unique: every grade has its own "A", "B", …
    label: classroomLabel(s, Locale.EN),
    // The Arabic label in the sublabel keeps it searchable in Arabic too.
    sublabel: classroomLabel(s, Locale.AR),
  }));
}
