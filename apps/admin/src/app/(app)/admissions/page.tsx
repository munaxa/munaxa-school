'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DatePicker,
  EntityPicker,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@axa/platform';
import { loadParentOptions, loadStudentOptions } from '@/lib/pickers';
import {
  admissionsApi,
  type AddFamilyStudentMode,
  type ComputedQuote,
  type FinancialAccountOwnerType,
  type IdentityLookupResult,
  type QuotePaymentMode,
  type TransportDirection,
} from '@/lib/admissions';
import { enrollmentExitApi } from '@/lib/enrollment-exit';
import { familiesApi } from '@/lib/families';
import { schoolsApi, campusesApi, gradesApi, academicYearsApi, sectionsApi } from '@/lib/structure';
import type { AcademicYear, Campus, Grade, Section } from '@/lib/structure';
import { areasApi, type Area } from '@/lib/areas';

const jod = (v: string | number) => `${Number(v).toFixed(3)} JOD`;
const DIRECTIONS: TransportDirection[] = ['NONE', 'ONE_WAY', 'TWO_WAY'];
const OWNER_TYPES: FinancialAccountOwnerType[] = [
  'GUARDIAN',
  'GRANDPARENT',
  'COMPANY',
  'CHARITY',
  'SPONSOR',
  'GOVERNMENT',
  'SCHOLARSHIP_ORG',
  'COURT_ORDER',
  'RELATIVE',
  'OTHER',
];

const STEPS = ['Account & plan', 'Students', 'Review & confirm'] as const;

interface StudentState {
  key: string;
  mode: 'NEW' | 'RETURNING';
  returningId: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  nationalId: string;
  gradeId: string;
  sectionId: string;
  transportDirection: TransportDirection;
  transportAreaId: string;
  transportTrip: string;
  overrides: Record<string, string>; // kind -> new amount (JOD)
  quote: (ComputedQuote & { quoteId?: string }) | null;
  quoting: boolean;
}

function blankStudent(): StudentState {
  return {
    key: Math.random().toString(36).slice(2),
    mode: 'NEW',
    returningId: '',
    firstNameEn: '',
    lastNameEn: '',
    firstNameAr: '',
    lastNameAr: '',
    nationalId: '',
    gradeId: '',
    sectionId: '',
    transportDirection: 'NONE',
    transportAreaId: '',
    transportTrip: '',
    overrides: {},
    quote: null,
    quoting: false,
  };
}

/**
 * Admission — the ONE admission wizard (account-first). A guardian/customer (new or existing) is the
 * Financial Account; you add one or more students, each fully configured (new or returning; grade;
 * section; transport area→route; registrar fee overrides). The account calculates ONE package on ONE
 * payment plan and generates ONE agreement. Adding to an EXISTING account offers Merge / Separate /
 * New-plan. Single-student is just the N=1 case. Munaxa Design System components only; RTL/LTR +
 * dark/light inherited.
 */
export default function AdmissionPage() {
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Shared placement + master data.
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState('');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [academicYearId, setAcademicYearId] = useState('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [sectionsByGrade, setSectionsByGrade] = useState<Record<string, Section[]>>({});

  // Family payment plan (account level).
  const [paymentMode, setPaymentMode] = useState<QuotePaymentMode>('INSTALLMENTS');
  const [installments, setInstallments] = useState('9');
  const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [registrationFeePaid, setRegistrationFeePaid] = useState(true);

  // Guardian / account holder.
  const [ownerType, setOwnerType] = useState<FinancialAccountOwnerType>('GUARDIAN');
  const [parentMode, setParentMode] = useState<'NEW' | 'EXISTING'>('NEW');
  const [existingParentId, setExistingParentId] = useState('');
  const [existingAccount, setExistingAccount] = useState<{ id: string; nameEn: string } | null>(
    null,
  );
  const [existingStudents, setExistingStudents] = useState<
    { firstNameEn: string; lastNameEn: string; gradeNameEn: string | null }[]
  >([]);
  const [addMode, setAddMode] = useState<AddFamilyStudentMode>('MERGE');
  const [pFirstEn, setPFirstEn] = useState('');
  const [pLastEn, setPLastEn] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pEmail, setPEmail] = useState('');

  const [students, setStudents] = useState<StudentState[]>([blankStudent()]);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const schools = await schoolsApi.list();
        if (schools[0]) {
          const cs = await campusesApi.list(schools[0].id);
          setCampuses(cs);
          if (cs[0]) setCampusId(cs[0].id);
        }
        setAreas(await areasApi.list({ active: true, transportAvailable: true }).catch(() => []));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load setup');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!campusId) return;
    void (async () => {
      const [ys, gs] = await Promise.all([
        academicYearsApi.list(campusId),
        gradesApi.list(campusId),
      ]);
      setYears(ys);
      setGrades(gs);
      const current = ys.find((y) => y.isCurrent) ?? ys[0];
      if (current) setAcademicYearId(current.id);
    })().catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load year/grades'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

  const loadSections = async (gradeId: string) => {
    if (!gradeId || sectionsByGrade[gradeId]) return;
    const secs = await sectionsApi.list(gradeId).catch(() => [] as Section[]);
    setSectionsByGrade((m) => ({ ...m, [gradeId]: secs }));
  };

  // When an existing guardian is chosen, load their account (if any) to enable Merge/Separate/New.
  useEffect(() => {
    if (parentMode !== 'EXISTING' || !existingParentId) {
      setExistingAccount(null);
      setExistingStudents([]);
      return;
    }
    void familiesApi
      .byParent(existingParentId)
      .then((r) => {
        setExistingAccount(r.account ? { id: r.account.id, nameEn: r.account.nameEn } : null);
        setExistingStudents(
          r.students.map((s) => ({
            firstNameEn: s.firstNameEn,
            lastNameEn: s.lastNameEn,
            gradeNameEn: s.gradeNameEn,
          })),
        );
      })
      .catch(() => {
        setExistingAccount(null);
        setExistingStudents([]);
      });
  }, [parentMode, existingParentId]);

  const patch = (key: string, p: Partial<StudentState>) =>
    setStudents((rows) =>
      rows.map((r) =>
        r.key === key
          ? {
              ...r,
              ...p,
              // Any pricing input change invalidates the quote.
              quote:
                p.gradeId !== undefined ||
                p.transportDirection !== undefined ||
                p.transportAreaId !== undefined ||
                p.returningId !== undefined
                  ? null
                  : r.quote,
            }
          : r,
      ),
    );

  const resolvedRoute = (s: StudentState) => {
    const area = areas.find((a) => a.id === s.transportAreaId) ?? null;
    return { id: area?.routeId ?? null, name: area?.route?.name ?? null };
  };

  const priceStudent = async (s: StudentState) => {
    if (!s.gradeId) return toast.error('Choose a grade for this student');
    if (s.transportDirection !== 'NONE' && !s.transportAreaId) {
      return toast.error('Select the transport area — it drives the route and the fee');
    }
    patch(s.key, { quoting: true });
    try {
      const route = resolvedRoute(s);
      const overrides = Object.entries(s.overrides)
        .filter(([, v]) => v.trim() !== '' && !Number.isNaN(Number(v)))
        .map(([kind, v]) => ({
          kind: kind as ComputedQuote['lines'][number]['kind'],
          amount: Number(v),
          reason: 'Registrar override',
        }));
      const quote = await admissionsApi.quote({
        gradeId: s.gradeId,
        academicYearId,
        ...(s.mode === 'RETURNING' && s.returningId ? { studentId: s.returningId } : {}),
        transportDirection: s.transportDirection,
        ...(s.transportDirection !== 'NONE' && route.name
          ? { transportRouteGroup: route.name }
          : {}),
        paymentMode,
        installments: paymentMode === 'INSTALLMENTS' ? Number(installments) : 1,
        firstDueDate,
        ...(overrides.length ? { overrides } : {}),
        persist: true,
      });
      quote.warnings.forEach((w) => toast.error(w));
      setStudents((rows) =>
        rows.map((r) => (r.key === s.key ? { ...r, quote, quoting: false } : r)),
      );
    } catch (e) {
      patch(s.key, { quoting: false });
      toast.error(e instanceof Error ? e.message : 'Failed to price this student');
    }
  };

  const grandTotal = useMemo(
    () => students.reduce((sum, s) => sum + (s.quote ? Number(s.quote.grandTotal) : 0), 0),
    [students],
  );
  const allQuoted = students.length > 0 && students.every((s) => s.quote?.quoteId);

  const guardianReady =
    parentMode === 'EXISTING' ? !!existingParentId : !!(pFirstEn && pLastEn && pPhone.trim());
  const canProceed = !!academicYearId && guardianReady;

  const entryFor = (s: StudentState) => {
    const route = resolvedRoute(s);
    return {
      quoteId: s.quote!.quoteId!,
      ...(s.mode === 'RETURNING'
        ? { existingStudentId: s.returningId }
        : {
            student: {
              firstNameEn: s.firstNameEn,
              lastNameEn: s.lastNameEn,
              firstNameAr: s.firstNameAr || s.firstNameEn,
              lastNameAr: s.lastNameAr || s.lastNameEn,
              ...(s.nationalId ? { nationalId: s.nationalId } : {}),
            },
          }),
      ...(s.sectionId ? { sectionId: s.sectionId } : {}),
      ...(s.transportDirection !== 'NONE'
        ? {
            transportRequested: true,
            ...(s.transportAreaId ? { areaId: s.transportAreaId } : {}),
            ...(route.id
              ? {
                  busRouteId: route.id,
                  ...(s.transportTrip ? { busTripRound: Number(s.transportTrip) } : {}),
                }
              : {}),
          }
        : { transportRequested: false }),
    };
  };

  const commit = async () => {
    if (!allQuoted) return toast.error('Price every student before committing');
    setCommitting(true);
    try {
      if (parentMode === 'EXISTING' && existingAccount) {
        // Add each student to the EXISTING account with the chosen billing mode.
        for (const s of students) {
          await admissionsApi.addFamilyStudent(existingAccount.id, {
            idempotencyKey: `add-${Date.now()}-${s.key}`,
            mode: addMode,
            registrationFeePaid,
            ...(addMode === 'NEW_PLAN'
              ? { confirm: true, paymentMode, installments: Number(installments), firstDueDate }
              : {}),
            ...entryFor(s),
          });
        }
        toast.success(`Added ${students.length} student(s) to ${existingAccount.nameEn}`);
      } else {
        // New account (or existing guardian without an account yet): one atomic family commit.
        await admissionsApi.familyCommit({
          idempotencyKey: `adm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          academicYearId,
          ...(parentMode === 'EXISTING'
            ? { existingParentId }
            : {
                parent: {
                  firstNameEn: pFirstEn,
                  lastNameEn: pLastEn,
                  phone: pPhone,
                  ...(pEmail ? { email: pEmail } : {}),
                  relation: 'GUARDIAN',
                },
              }),
          ownerType,
          paymentMode,
          installments: paymentMode === 'INSTALLMENTS' ? Number(installments) : 1,
          firstDueDate,
          registrationFeePaid,
          students: students.map(entryFor),
        });
        toast.success(`Registered ${students.length} student(s)`);
      }
      router.push('/finance');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Admission"
          description="One guardian/customer, one payment plan, one or more students — a single package and one agreement."
          actions={
            /* Identity-first entry (A/B/C): check the student by National ID before admitting. */
            <Link href="/admissions/identity">
              <Button variant="outline" size="sm">
                Identity Check
              </Button>
            </Link>
          }
        />

        <div className="flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <Badge key={label} tone={i === step ? 'default' : i < step ? 'success' : 'muted'}>
              {i + 1}. {label}
            </Badge>
          ))}
        </div>

        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Account & payment plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Campus">
                  <Select value={campusId} onChange={(e) => setCampusId(e.target.value)}>
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Academic year">
                  <Select
                    value={academicYearId}
                    onChange={(e) => setAcademicYearId(e.target.value)}
                  >
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Payment plan">
                  <Select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as QuotePaymentMode)}
                  >
                    <option value="INSTALLMENTS">Installments</option>
                    <option value="FULL">Pay in full</option>
                  </Select>
                </Field>
                {paymentMode === 'INSTALLMENTS' && (
                  <Field label="Number of installments">
                    <Input
                      type="number"
                      min="1"
                      max="12"
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                    />
                  </Field>
                )}
                <Field label="First due date">
                  <DatePicker value={firstDueDate} onChange={(value) => setFirstDueDate(value)} />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account holder type">
                  <Select
                    value={ownerType}
                    onChange={(e) => setOwnerType(e.target.value as FinancialAccountOwnerType)}
                  >
                    {OWNER_TYPES.map((o) => (
                      <option key={o} value={o}>
                        {o.replace('_', ' ')}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Guardian">
                  <Select
                    value={parentMode}
                    onChange={(e) => setParentMode(e.target.value as 'NEW' | 'EXISTING')}
                  >
                    <option value="NEW">New guardian</option>
                    <option value="EXISTING">Existing guardian</option>
                  </Select>
                </Field>
              </div>

              {parentMode === 'EXISTING' ? (
                <div className="space-y-3">
                  <Field label="Select guardian">
                    <EntityPicker
                      value={existingParentId}
                      onChange={setExistingParentId}
                      load={loadParentOptions}
                      placeholder="Search guardians…"
                    />
                  </Field>
                  {existingAccount && (
                    <Card>
                      <CardContent className="space-y-2 p-4">
                        <p className="text-sm">
                          <Badge tone="success">Existing account</Badge> {existingAccount.nameEn} —{' '}
                          {existingStudents.length} student(s):{' '}
                          {existingStudents
                            .map((s) => `${s.firstNameEn} ${s.lastNameEn}`)
                            .join(', ') || '—'}
                        </p>
                        <Field label="How should the new students be billed?">
                          <Select
                            value={addMode}
                            onChange={(e) => setAddMode(e.target.value as AddFamilyStudentMode)}
                          >
                            <option value="MERGE">
                              Merge into the existing plan (recalc remaining installments)
                            </option>
                            <option value="SEPARATE">Keep a separate plan</option>
                            <option value="NEW_PLAN">Start a new plan (affects accounting)</option>
                          </Select>
                        </Field>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name">
                    <Input value={pFirstEn} onChange={(e) => setPFirstEn(e.target.value)} />
                  </Field>
                  <Field label="Last name">
                    <Input value={pLastEn} onChange={(e) => setPLastEn(e.target.value)} />
                  </Field>
                  <Field label="Mobile number">
                    <Input value={pPhone} onChange={(e) => setPPhone(e.target.value)} />
                  </Field>
                  <Field label="Email (optional)">
                    <Input value={pEmail} onChange={(e) => setPEmail(e.target.value)} />
                  </Field>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={registrationFeePaid}
                  onChange={(e) => setRegistrationFeePaid(e.target.checked)}
                />
                Registration fee paid at registration (billed once, not spread over the plan)
              </label>

              <div className="flex justify-end">
                <Button disabled={!canProceed} onClick={() => setStep(1)}>
                  Next: students
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {students.map((s, idx) => (
              <StudentCard
                key={s.key}
                index={idx}
                value={s}
                canRemove={students.length > 1}
                grades={grades}
                areas={areas}
                sections={sectionsByGrade[s.gradeId] ?? []}
                onRemove={() => setStudents((rows) => rows.filter((r) => r.key !== s.key))}
                onChange={(p) => patch(s.key, p)}
                onGradeChange={(gid) => {
                  patch(s.key, { gradeId: gid, sectionId: '' });
                  void loadSections(gid);
                }}
                onPrice={() => void priceStudent(s)}
              />
            ))}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setStudents((rows) => [...rows, blankStudent()])}
              >
                + Add student
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button disabled={!allQuoted} onClick={() => setStep(2)}>
                  Next: review
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Financial summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <THead>
                  <TR>
                    <TH>Student</TH>
                    <TH>Grade</TH>
                    <TH>Transport</TH>
                    <TH>Total</TH>
                  </TR>
                </THead>
                <TBody>
                  {students.map((s) => (
                    <TR key={s.key}>
                      <TD>
                        {s.mode === 'RETURNING'
                          ? 'Returning student'
                          : `${s.firstNameEn} ${s.lastNameEn}`}
                      </TD>
                      <TD>{grades.find((g) => g.id === s.gradeId)?.nameEn ?? '—'}</TD>
                      <TD>{s.transportDirection.replace('_', ' ')}</TD>
                      <TD>{s.quote ? jod(s.quote.grandTotal) : '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <div className="flex items-center justify-between rounded-md bg-muted/40 p-4">
                <div className="text-sm text-muted-foreground">
                  {parentMode === 'EXISTING' && existingAccount
                    ? `Adding to ${existingAccount.nameEn} · ${addMode.replace('_', ' ').toLowerCase()}`
                    : paymentMode === 'INSTALLMENTS'
                      ? `${installments} account installments from ${firstDueDate}`
                      : 'Pay in full'}
                </div>
                <div className="text-lg font-semibold">Grand total: {jod(grandTotal)}</div>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button disabled={committing || !allQuoted} onClick={() => void commit()}>
                  {committing ? 'Registering…' : 'Confirm registration'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Shell>
  );
}

function StudentCard({
  index,
  value: s,
  canRemove,
  grades,
  areas,
  sections,
  onRemove,
  onChange,
  onGradeChange,
  onPrice,
}: {
  index: number;
  value: StudentState;
  canRemove: boolean;
  grades: Grade[];
  areas: Area[];
  sections: Section[];
  onRemove: () => void;
  onChange: (p: Partial<StudentState>) => void;
  onGradeChange: (gradeId: string) => void;
  onPrice: () => void;
}) {
  // Live identity check while typing a National ID for a NEW student (Decision — one Admission, no
  // duplicates). Debounced; if the ID already belongs to a student we surface it immediately —
  // including a withdrawn/returning student — so the registrar re-enrols instead of duplicating.
  const [idLookup, setIdLookup] = useState<IdentityLookupResult | null>(null);
  const nid = s.nationalId.trim();
  useEffect(() => {
    if (s.mode !== 'NEW' || nid.length < 3) {
      setIdLookup(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      admissionsApi
        .identityLookup({ nationalId: nid })
        .then((r) => active && setIdLookup(r.student ? r : null))
        .catch(() => active && setIdLookup(null));
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [nid, s.mode]);

  const cardToast = useToast();
  // Reactivate a withdrawn CURRENT-year enrollment inline (reverse of withdraw) — no screen change.
  // On success the lookup re-runs and the banner flips to "already enrolled this year".
  async function reactivateInline(enrollmentId: string) {
    try {
      await enrollmentExitApi.reactivate(enrollmentId, {});
      cardToast.success('Student reactivated — enrolled for this year');
      const r = await admissionsApi.identityLookup({ nationalId: nid });
      setIdLookup(r.student ? r : null);
    } catch (e) {
      cardToast.error(e instanceof Error ? e.message : 'Reactivate failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Student {index + 1}
          {canRemove && (
            <Button variant="ghost" className="ml-2" onClick={onRemove}>
              Remove
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Student">
          <Select
            value={s.mode}
            onChange={(e) => onChange({ mode: e.target.value as 'NEW' | 'RETURNING' })}
          >
            <option value="NEW">New student</option>
            <option value="RETURNING">Returning student</option>
          </Select>
        </Field>

        {s.mode === 'RETURNING' ? (
          <Field label="Select returning student">
            <EntityPicker
              value={s.returningId}
              onChange={(id) => onChange({ returningId: id })}
              load={loadStudentOptions}
              placeholder="Search students…"
            />
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name (EN)">
              <Input
                value={s.firstNameEn}
                onChange={(e) => onChange({ firstNameEn: e.target.value })}
              />
            </Field>
            <Field label="Last name (EN)">
              <Input
                value={s.lastNameEn}
                onChange={(e) => onChange({ lastNameEn: e.target.value })}
              />
            </Field>
            <Field label="National ID">
              <Input
                value={s.nationalId}
                onChange={(e) => onChange({ nationalId: e.target.value })}
              />
            </Field>
            {idLookup?.student ? (
              <div
                className={`sm:col-span-2 rounded-lg border p-3 text-sm ${
                  idLookup.case === 'ACTIVE'
                    ? 'border-destructive/40 bg-destructive/5'
                    : 'border-warning/40 bg-warning/5'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">
                      {idLookup.case === 'ACTIVE'
                        ? 'This National ID is already enrolled this year'
                        : 'This National ID belongs to an existing student — re-enrol them here?'}
                    </span>
                    <div className="text-muted-foreground">
                      {idLookup.student.firstNameEn} {idLookup.student.lastNameEn}
                      {idLookup.student.studentNumber ? ` · ${idLookup.student.studentNumber}` : ''}
                      {' · '}
                      {idLookup.currentEnrollment
                        ? `${idLookup.currentEnrollment.academicYearName} · ${idLookup.currentEnrollment.gradeName} · ${idLookup.currentEnrollment.status.toLowerCase()}`
                        : 'not currently enrolled'}
                    </div>
                  </div>
                  {idLookup.case === 'ACTIVE' ? null : idLookup.currentEnrollment &&
                    idLookup.currentEnrollment.status.toUpperCase() === 'WITHDRAWN' ? (
                    // Withdrawn from the CURRENT year → reactivate in place (reverse of withdraw),
                    // without leaving this screen. Re-opens the cancelled charges server-side.
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void reactivateInline(idLookup.currentEnrollment!.id)}
                    >
                      Reactivate here
                    </Button>
                  ) : (
                    // Returning (not enrolled this year) → re-enrol WITHOUT leaving this screen: flip
                    // the row to RETURNING with the student pre-selected; the admission flow continues.
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        onChange({ mode: 'RETURNING', returningId: idLookup.student!.id })
                      }
                    >
                      Re-enrol here
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Grade">
            <Select value={s.gradeId} onChange={(e) => onGradeChange(e.target.value)}>
              <option value="">Select grade…</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Section (optional)">
            <Select value={s.sectionId} onChange={(e) => onChange({ sectionId: e.target.value })}>
              <option value="">—</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Transportation">
            <Select
              value={s.transportDirection}
              onChange={(e) =>
                onChange({ transportDirection: e.target.value as TransportDirection })
              }
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </Field>
          {s.transportDirection !== 'NONE' && (
            <Field label="Transport area (drives route + fee)">
              <Select
                value={s.transportAreaId}
                onChange={(e) => onChange({ transportAreaId: e.target.value })}
              >
                <option value="">Select area…</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.route?.name ? ` · ${a.route.name}` : ' · (no route yet)'}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {/* Fee overrides (advanced): edit any line's amount after pricing, then re-price. */}
        {s.quote && s.quote.lines.length > 0 && (
          <details className="rounded-md border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Fee overrides (advanced)
            </summary>
            <div className="mt-3 space-y-2">
              {s.quote.lines.map((l) => (
                <div key={l.kind} className="flex items-center gap-2">
                  <span className="w-40 text-sm">{l.label}</span>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder={l.amount}
                    value={s.overrides[l.kind] ?? ''}
                    onChange={(e) =>
                      onChange({ overrides: { ...s.overrides, [l.kind]: e.target.value } })
                    }
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Leave blank to keep the catalog amount. Re-price to apply.
              </p>
            </div>
          </details>
        )}

        <div className="flex items-center justify-between">
          <div className="text-sm">
            {s.quote ? (
              <span className="font-semibold">{jod(s.quote.grandTotal)}</span>
            ) : (
              <span className="text-muted-foreground">Not priced yet</span>
            )}
          </div>
          <Button variant="outline" disabled={s.quoting} onClick={onPrice}>
            {s.quoting ? 'Pricing…' : s.quote ? 'Re-price' : 'Price student'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
