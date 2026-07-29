import { BadRequestException, Injectable } from '@nestjs/common';
import { EnrollmentStatus } from '@prisma/client';
import { StudentIdentityRepository, type IdentityStudent } from './student-identity.repository';

/**
 * The three admission cases (Decision — one Admission, identity-first):
 *   NEW       — no student with this identifier → proceed with a normal admission.
 *   ACTIVE    — student exists and is actively enrolled in the current year → "already enrolled".
 *   RETURNING — student exists but is not actively enrolled → Re-Enroll (never create a new Student).
 */
export type AdmissionCase = 'NEW' | 'ACTIVE' | 'RETURNING';

export interface IdentityStudentSummary {
  id: string;
  studentNumber: string | null;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  nationalId: string | null;
  moeStudentNumber: string | null;
  /** The Financial Account (Payer) this student is billed through, if any. */
  financialAccountId: string | null;
}

export interface IdentityLookupResult {
  case: AdmissionCase;
  student: IdentityStudentSummary | null;
  currentEnrollment: {
    id: string;
    status: EnrollmentStatus;
    gradeName: string;
    academicYearName: string;
  } | null;
}

function toSummary(s: IdentityStudent): IdentityStudentSummary {
  return {
    id: s.id,
    studentNumber: s.studentNumber,
    firstNameEn: s.firstNameEn,
    lastNameEn: s.lastNameEn,
    firstNameAr: s.firstNameAr,
    lastNameAr: s.lastNameAr,
    nationalId: s.nationalId,
    moeStudentNumber: s.moeStudentNumber,
    financialAccountId: s.financialAccount?.payerId ?? null,
  };
}

@Injectable()
export class StudentIdentityService {
  constructor(private readonly repo: StudentIdentityRepository) {}

  /**
   * Identity-first admission lookup. National ID is the primary key, MoE number the fallback — exact
   * match only, never fuzzy. Returns the case (A/B/C) plus the student + billing + current-year
   * enrollment so the one admission wizard can branch.
   */
  async lookupByIdentifier(input: {
    nationalId?: string;
    moeStudentNumber?: string;
  }): Promise<IdentityLookupResult> {
    const nationalId = input.nationalId?.trim() || undefined;
    const moeStudentNumber = input.moeStudentNumber?.trim() || undefined;
    if (!nationalId && !moeStudentNumber) {
      throw new BadRequestException('A National ID or Ministry Student Number is required');
    }

    const student = await this.repo.findByIdentifier(nationalId, moeStudentNumber);
    if (!student) return { case: 'NEW', student: null, currentEnrollment: null };

    const current = await this.repo.currentEnrollment(student.id);
    // ACTIVE (already enrolled) requires a current-year enrollment that is actually participating.
    const isActive = current?.status === EnrollmentStatus.ACTIVE;
    return {
      case: isActive ? 'ACTIVE' : 'RETURNING',
      student: toSummary(student),
      currentEnrollment: current
        ? {
            id: current.id,
            status: current.status,
            gradeName: current.grade.nameEn,
            academicYearName: current.academicYear.name,
          }
        : null,
    };
  }

  /**
   * Informational similar-name search shown BEFORE the identifier is entered. Never blocks admission and
   * never substitutes for the National-ID/MoE identity check. Returns [] for a blank/too-short query.
   */
  async similarNames(name: string): Promise<IdentityStudentSummary[]> {
    const q = name?.trim() ?? '';
    if (q.length < 2) return [];
    const rows = await this.repo.similarByName(q);
    return rows.map(toSummary);
  }
}
