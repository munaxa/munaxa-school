/**
 * Academic-Year migration validator (Student-Lifecycle refactor — Rev. 3 Decision 1).
 *
 * READ-ONLY. Changes nothing. This is the GATE that must pass before the Phase-B cleanup migration
 * (which re-scopes Academic Year uniqueness from campus → school, adds the single-ACTIVE-per-school
 * constraint, and drops `campusId`).
 *
 * It detects, per tenant:
 *   1. Duplicate Academic Years — same School + same year Name (would violate the future
 *      @@unique[tenantId, schoolId, name]).
 *   2. Schools with more than one ACTIVE Academic Year (would violate single-ACTIVE-per-school).
 *
 * On ANY conflict it prints a human-readable report, writes machine-readable JSON, and exits non-zero
 * so the deploy/cleanup pipeline ABORTS. NO silent merge, no automatic consolidation — an
 * administrator must resolve conflicts (rename / retire duplicate years) first.
 *
 * Usage:
 *   DATABASE_URL=... tsx scripts/validate-academic-year-migration.ts [--json out.json]
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

type YearRow = {
  tenantId: string;
  tenantName: string;
  schoolId: string | null;
  schoolName: string | null;
  academicYearId: string;
  name: string;
  status: string | null;
  isCurrent: boolean;
};

type Conflict = {
  tenantId: string;
  tenantName: string;
  schoolId: string | null;
  schoolName: string | null;
  kind: 'DUPLICATE_YEAR_NAME' | 'MULTIPLE_ACTIVE';
  yearName: string | null;
  offendingYears: { id: string; name: string; status: string | null; isCurrent: boolean }[];
};

async function main(): Promise<void> {
  const jsonFlagIdx = process.argv.indexOf('--json');
  const jsonOut = jsonFlagIdx >= 0 ? process.argv[jsonFlagIdx + 1] : undefined;

  const prisma = new PrismaClient();
  try {
    // Derive the school via COALESCE(schoolId, campus.schoolId) so the validator works whether or not
    // the additive backfill has run yet. Raw SQL keeps it independent of the generated client types.
    const rows = await prisma.$queryRaw<YearRow[]>`
      SELECT
        ay."tenantId"                              AS "tenantId",
        t."name"                                   AS "tenantName",
        COALESCE(ay."schoolId", c."schoolId")      AS "schoolId",
        s."nameEn"                                 AS "schoolName",
        ay."id"                                    AS "academicYearId",
        ay."name"                                  AS "name",
        ay."status"::text                          AS "status",
        ay."isCurrent"                             AS "isCurrent"
      FROM "AcademicYear" ay
      JOIN "Tenant" t   ON t."id" = ay."tenantId"
      JOIN "Campus" c   ON c."id" = ay."campusId"
      LEFT JOIN "School" s ON s."id" = COALESCE(ay."schoolId", c."schoolId")
      ORDER BY ay."tenantId", "schoolId", ay."name"
    `;

    const conflicts: Conflict[] = [];
    const groupInto = (map: Map<string, YearRow[]>, key: string, row: YearRow): void => {
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    };

    // 1. Duplicate (school, name).
    const bySchoolName = new Map<string, YearRow[]>();
    for (const r of rows) {
      groupInto(bySchoolName, `${r.tenantId}::${r.schoolId ?? 'NO_SCHOOL'}::${r.name}`, r);
    }
    for (const group of bySchoolName.values()) {
      if (group.length > 1) {
        const g = group[0];
        conflicts.push({
          tenantId: g.tenantId,
          tenantName: g.tenantName,
          schoolId: g.schoolId,
          schoolName: g.schoolName,
          kind: 'DUPLICATE_YEAR_NAME',
          yearName: g.name,
          offendingYears: group.map((r) => ({
            id: r.academicYearId,
            name: r.name,
            status: r.status,
            isCurrent: r.isCurrent,
          })),
        });
      }
    }

    // 2. More than one ACTIVE per school (status ACTIVE or the legacy isCurrent flag).
    const bySchool = new Map<string, YearRow[]>();
    for (const r of rows) {
      groupInto(bySchool, `${r.tenantId}::${r.schoolId ?? 'NO_SCHOOL'}`, r);
    }
    for (const group of bySchool.values()) {
      const active = group.filter((r) => r.status === 'ACTIVE' || r.isCurrent);
      if (active.length > 1) {
        const g = group[0];
        conflicts.push({
          tenantId: g.tenantId,
          tenantName: g.tenantName,
          schoolId: g.schoolId,
          schoolName: g.schoolName,
          kind: 'MULTIPLE_ACTIVE',
          yearName: null,
          offendingYears: active.map((r) => ({
            id: r.academicYearId,
            name: r.name,
            status: r.status,
            isCurrent: r.isCurrent,
          })),
        });
      }
    }

    const tenants = new Set(rows.map((r) => r.tenantId)).size;
    console.log('── Academic-Year migration validation ──────────────────────────────');
    console.log(`Scanned ${rows.length} academic years across ${tenants} tenant(s).`);

    if (conflicts.length === 0) {
      console.log('✓ No conflicts. Phase-B school-scoped cleanup is safe to proceed.');
      if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ ok: true, conflicts: [] }, null, 2));
      await prisma.$disconnect();
      process.exit(0);
    }

    console.error(`\n✗ ${conflicts.length} conflict(s) found. Phase-B cleanup is ABORTED.\n`);
    for (const c of conflicts) {
      const school = c.schoolName ?? c.schoolId ?? '(unresolved school)';
      console.error(`  [${c.kind}] tenant "${c.tenantName}" · school "${school}"`);
      if (c.yearName) console.error(`     year name: "${c.yearName}"`);
      for (const y of c.offendingYears) {
        console.error(
          `       - ${y.id}  name="${y.name}"  status=${y.status ?? '?'}  isCurrent=${y.isCurrent}`,
        );
      }
    }
    console.error(
      '\nResolve these (rename/retire duplicate years, or leave exactly one ACTIVE per school)\n' +
        'via admin tooling, then re-run this validator. No records were changed.',
    );
    if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ ok: false, conflicts }, null, 2));

    await prisma.$disconnect();
    process.exit(1);
  } catch (err) {
    await prisma.$disconnect();
    console.error('Validator failed to run:', err);
    process.exit(2);
  }
}

void main();
