'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
  Select,
  useToast,
} from '@axa/platform';
import { studentsApi, type Student, type EnrollmentHistoryRow } from '@/lib/people';
import { financeApi, type Statement } from '@/lib/finance';
import { busApi, type StudentTransport } from '@/lib/bus';
import { enrollmentExitApi } from '@/lib/enrollment-exit';
import { enrollmentChangeApi } from '@/lib/enrollment-change';
import { sectionsApi, type Section } from '@/lib/structure';

const num = (v: string | number) => Number(v).toFixed(3);

/**
 * Overview tab: identity details plus a light, at-a-glance finance + transport snapshot.
 * Fetches only the small summaries it shows (statement totals, transport) — the heavy finance
 * workspace lives in its own lazy tab.
 */
export function OverviewTab({
  student,
  onChanged,
}: {
  student: Student;
  onChanged?: (() => void | Promise<void>) | undefined;
}) {
  const { t } = useI18n();
  const [statement, setStatement] = useState<Statement | null>(null);
  const [transport, setTransport] = useState<StudentTransport | null>(null);
  const [history, setHistory] = useState<EnrollmentHistoryRow[]>([]);
  const [withdrawRow, setWithdrawRow] = useState<EnrollmentHistoryRow | null>(null);
  const [reactivateRow, setReactivateRow] = useState<EnrollmentHistoryRow | null>(null);
  const [changePlacement, setChangePlacement] = useState(false);

  const loadHistory = useCallback(
    () => studentsApi.enrollmentHistory(student.id).then(setHistory),
    [student.id],
  );

  useEffect(() => {
    let active = true;
    financeApi
      .statement(student.id)
      .then((s) => active && setStatement(s))
      .catch(() => undefined);
    busApi
      .studentTransport(student.id)
      .then((tr) => active && setTransport(tr))
      .catch(() => undefined);
    void loadHistory().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [student.id, loadHistory]);

  // The student's CURRENTLY-PARTICIPATING enrollment (active academic year, ACTIVE participation).
  // Only this row can be withdrawn; closed/terminal years are immutable history (Decision 12).
  const currentEnrollment = history.find(
    (r) => r.academicYear?.status === 'ACTIVE' && r.status === 'ACTIVE',
  );
  // A WITHDRAWN enrollment in the active year can be reactivated (reverse of withdraw) — same screen.
  const withdrawnCurrent = history.find(
    (r) => r.academicYear?.status === 'ACTIVE' && r.status === 'WITHDRAWN',
  );

  const tripLabel = transport?.tripRound
    ? transport.tripRound === 1
      ? t('fleet.trip1')
      : transport.tripRound === 2
        ? t('fleet.trip2')
        : t('transport.trip.both')
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('people.details')}</CardTitle>
        </CardHeader>
        {/* Identity only — personal info + identifiers. Academic placement + transport are shown in
            the Current Enrollment panel below (they belong to the Enrollment, never the Student). */}
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Detail label={t('people.nationalId')} value={student.nationalId} mono />
          <Detail label={t('people.moeNumber')} value={student.moeStudentNumber} mono />
          <Detail label={t('people.qr')} value={student.qrCode} mono />
          <Detail label={t('common.status')} value={student.status} />
          <Detail
            label={t('people.gender')}
            value={student.gender ? t(`people.${student.gender.toLowerCase()}`) : null}
          />
          <Detail
            label={t('people.admitted')}
            value={student.enrollmentDate ? student.enrollmentDate.slice(0, 10) : null}
            mono
          />
        </CardContent>
      </Card>

      {statement ? (
        <Card className={Number(statement.totals.outstanding) > 0 ? 'border-accent-warm/40' : ''}>
          <CardHeader>
            <CardTitle>{t('nav.finance')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Snapshot label={t('studentProfile.totalFees')} value={num(statement.totals.charged)} />
            <Snapshot
              label={t('finance.paid')}
              value={num(statement.totals.paid)}
              tone="text-accent-cool"
            />
            <Snapshot
              label={t('finance.outstanding')}
              value={num(statement.totals.outstanding)}
              tone={Number(statement.totals.outstanding) > 0 ? 'text-accent-warm' : undefined}
            />
            <Snapshot
              label={t('finance.credit')}
              value={num(statement.totals.creditBalance)}
              tone={Number(statement.totals.creditBalance) > 0 ? 'text-accent-cool' : undefined}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Current Enrollment — the single place to change grade/placement (never the Student). */}
      {currentEnrollment ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>{t('studentProfile.currentEnrollment')}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setChangePlacement(true)}>
              {t('studentProfile.changePlacement')}
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Detail
              label={t('studentProfile.academicYear')}
              value={currentEnrollment.academicYear?.name ?? null}
            />
            <Detail label={t('structure.grade')} value={currentEnrollment.grade?.nameEn ?? null} />
            <Detail
              label={t('structure.section')}
              value={currentEnrollment.section?.name ?? null}
            />
            <Detail label={t('common.status')} value={currentEnrollment.status.toLowerCase()} />
            <Detail
              label={t('fleet.route')}
              value={
                transport?.routeName
                  ? tripLabel
                    ? `${transport.routeName} · ${tripLabel}`
                    : transport.routeName
                  : null
              }
            />
            <Detail
              label={t('fleet.busNumber')}
              value={transport?.busNumber ?? transport?.busPlate ?? null}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('studentProfile.enrollmentHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('studentProfile.noEnrollments')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {row.academicYear?.name ?? '—'}
                      <span className="text-muted-foreground">
                        {row.grade ? ` · ${row.grade.nameEn}` : ''}
                        {row.section ? ` · ${row.section.name}` : ''}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      {(row.graduationDate ?? row.withdrawalDate ?? row.admissionDate ?? '').slice(
                        0,
                        10,
                      )}
                      {row.reason ? ` · ${row.reason}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={statusTone(row.status)}>{row.status.toLowerCase()}</Badge>
                    {currentEnrollment && row.id === currentEnrollment.id ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWithdrawRow(row)}
                        className="text-destructive"
                      >
                        {t('studentProfile.withdraw')}
                      </Button>
                    ) : null}
                    {withdrawnCurrent && row.id === withdrawnCurrent.id ? (
                      <Button size="sm" onClick={() => setReactivateRow(row)}>
                        {t('studentProfile.reactivate')}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {withdrawRow ? (
        <WithdrawDialog
          row={withdrawRow}
          onClose={() => setWithdrawRow(null)}
          onDone={async () => {
            setWithdrawRow(null);
            await loadHistory().catch(() => undefined);
            await onChanged?.();
          }}
        />
      ) : null}

      {reactivateRow ? (
        <ReactivateDialog
          row={reactivateRow}
          onClose={() => setReactivateRow(null)}
          onDone={async () => {
            setReactivateRow(null);
            await loadHistory().catch(() => undefined);
            await onChanged?.();
          }}
        />
      ) : null}

      {changePlacement && currentEnrollment ? (
        <PlacementDialog
          enrollment={currentEnrollment}
          onClose={() => setChangePlacement(false)}
          onDone={async () => {
            setChangePlacement(false);
            await loadHistory().catch(() => undefined);
            await onChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Reason-first placement change (Decision — the system asks WHY before deciding HOW). Grade Correction
 * and Administrative Transfer edit the current Enrollment (never the Student); Promotion and Repeat are
 * Year-End Processing operations that create a NEW enrollment, so they are redirected, not performed
 * here. PR 1 makes no ledger change — a grade change only WARNS that fees should be reviewed in Finance.
 */
type PlacementReason = 'CORRECTION' | 'TRANSFER' | 'PROMOTION' | 'REPEAT';

function PlacementDialog({
  enrollment,
  onClose,
  onDone,
}: {
  enrollment: EnrollmentHistoryRow;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState<PlacementReason | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [gradeId, setGradeId] = useState(enrollment.grade?.id ?? '');
  const [sectionId, setSectionId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  // PR 2 — after a grade correction that may affect fees, the admin sees the impact and explicitly
  // chooses Keep Existing Fees or Recalculate Fees. Recalculation NEVER runs automatically.
  const [feeStep, setFeeStep] = useState<Awaited<
    ReturnType<typeof enrollmentChangeApi.feeComparison>
  > | null>(null);
  const [phase, setPhase] = useState<'review' | 'confirm'>('review');

  useEffect(() => {
    sectionsApi
      .list()
      .then(setSections)
      .catch(() => undefined);
  }, []);

  const grades = [
    ...new Map(
      sections
        .filter((s) => s.grade)
        .map((s) => [
          s.grade!.id,
          { id: s.grade!.id, name: s.grade!.nameEn, level: s.grade!.level },
        ]),
    ).values(),
  ].sort((a, b) => a.level - b.level);

  // Correction: sections of the CHOSEN grade. Transfer: sections of the CURRENT grade only.
  const sectionOptions = sections.filter((s) =>
    reason === 'TRANSFER' ? s.grade?.id === enrollment.grade?.id : s.grade?.id === gradeId,
  );

  async function submit() {
    setSaving(true);
    try {
      if (reason === 'TRANSFER') {
        if (!sectionId) {
          toast.error(t('studentProfile.pickSection'));
          return;
        }
        await enrollmentChangeApi.transfer(enrollment.id, {
          sectionId,
          ...(note.trim() ? { reason: note.trim() } : {}),
        });
        toast.success(t('studentProfile.placementUpdated'));
        await onDone();
      } else if (reason === 'CORRECTION') {
        if (!gradeId) {
          toast.error(t('studentProfile.pickGrade'));
          return;
        }
        const res = await enrollmentChangeApi.correctGrade(enrollment.id, {
          gradeId,
          ...(sectionId ? { sectionId } : {}),
          ...(note.trim() ? { reason: note.trim() } : {}),
        });
        if (res.feesMayChange) {
          // Grade corrected; now show the financial impact and let the admin decide (no auto re-price).
          setFeeStep(await enrollmentChangeApi.feeComparison(enrollment.id));
        } else {
          toast.success(t('studentProfile.placementUpdated'));
          await onDone();
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Change failed');
    } finally {
      setSaving(false);
    }
  }

  async function keepFees() {
    toast.success(t('studentProfile.placementUpdated'));
    await onDone();
  }

  async function recalcFees() {
    setSaving(true);
    try {
      await enrollmentChangeApi.recalculateFees(enrollment.id);
      toast.success(t('studentProfile.feesRecalculated'));
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Recalculate failed');
    } finally {
      setSaving(false);
    }
  }

  const redirect = reason === 'PROMOTION' || reason === 'REPEAT';

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative my-8 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-card"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="font-display text-lg font-semibold">
          {t('studentProfile.changePlacement')}
        </h2>
        {feeStep && phase === 'review' ? (
          // PR 2, Step 3 — REVIEW FINANCIAL IMPACT. A business-decision screen. Nothing has changed yet;
          // the grade correction is applied, but the ledger is untouched until the admin confirms.
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('studentProfile.reviewFinancialImpact')}
              {feeStep.previousGradeName && feeStep.newGradeName ? (
                <span className="font-medium text-foreground">
                  {' '}
                  {feeStep.previousGradeName} → {feeStep.newGradeName}
                </span>
              ) : null}
            </p>
            <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
              <ImpactRow
                label={t('studentProfile.currentTuition')}
                value={feeStep.currentTuition}
              />
              <ImpactRow label={t('studentProfile.newTuition')} value={feeStep.newTuition} />
              <div className="flex justify-between border-t border-border pt-1 font-medium">
                <span>{t('studentProfile.difference')}</span>
                <span
                  className={`font-mono ${Number(feeStep.difference) > 0 ? 'text-accent-warm' : Number(feeStep.difference) < 0 ? 'text-accent-cool' : ''}`}
                >
                  {Number(feeStep.difference) > 0 ? '+' : ''}
                  {feeStep.difference}
                </span>
              </div>
              <ImpactRow
                label={t('studentProfile.registrationFee')}
                value={t('studentProfile.unchanged')}
                muted
              />
              <ImpactRow
                label={t('studentProfile.chargesUnchanged')}
                value={String(feeStep.chargesUnchanged)}
                muted
              />
              <ImpactRow
                label={t('studentProfile.chargesReplaced')}
                value={String(feeStep.unpaidChargesToReplace)}
                muted
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('studentProfile.recalcNote')}</p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void keepFees()}
                disabled={saving}
              >
                {t('studentProfile.keepFees')}
              </Button>
              <Button type="button" onClick={() => setPhase('confirm')} disabled={saving}>
                {t('studentProfile.reviewNewFees')}
              </Button>
            </div>
          </div>
        ) : feeStep && phase === 'confirm' ? (
          // PR 2, Step 4 — CONFIRMATION. Exactly what will happen before any ledger write.
          <div className="mt-3 space-y-3">
            <p className="text-sm font-medium">{t('studentProfile.confirmNewFees')}</p>
            <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
              <ImpactRow
                label={t('studentProfile.currentTuition')}
                value={feeStep.currentTuition}
              />
              <ImpactRow label={t('studentProfile.newTuition')} value={feeStep.newTuition} />
              <ImpactRow
                label={t('studentProfile.registrationFee')}
                value={t('studentProfile.unchanged')}
                muted
              />
              <ImpactRow
                label={t('studentProfile.paidChargesAffected')}
                value={String(feeStep.paidChargesAffected)}
                muted
              />
              <ImpactRow
                label={t('studentProfile.unpaidChargesReplaced')}
                value={String(feeStep.unpaidChargesToReplace)}
                muted
              />
              {Number(feeStep.creditAmount) > 0 ? (
                <ImpactRow label={t('finance.credit')} value={feeStep.creditAmount} />
              ) : null}
              {Number(feeStep.additionalAmount) > 0 ? (
                <ImpactRow
                  label={t('studentProfile.additionalAmount')}
                  value={feeStep.additionalAmount}
                />
              ) : null}
              <div className="flex justify-between border-t border-border pt-1 font-medium">
                <span>{t('studentProfile.newTotal')}</span>
                <span className="font-mono">{feeStep.newTotal}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPhase('review')}
                disabled={saving}
              >
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={() => void recalcFees()} disabled={saving}>
                {saving ? t('common.saving') : t('studentProfile.applyNewFees')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('studentProfile.changeReasonAsk')}
            </p>

            {/* Step 1 — WHY. */}
            <div className="mt-3 grid gap-2">
              {(['CORRECTION', 'TRANSFER', 'PROMOTION', 'REPEAT'] as PlacementReason[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setReason(r);
                    setSectionId('');
                    setGradeId(enrollment.grade?.id ?? '');
                  }}
                  className={`rounded-lg border px-3 py-2 text-start text-sm ${
                    reason === r
                      ? 'border-primary-strong bg-primary/5'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <div className="font-medium">{t(`studentProfile.reason_${r}`)}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(`studentProfile.reasonHint_${r}`)}
                  </div>
                </button>
              ))}
            </div>

            {/* Step 2 — HOW. */}
            {reason === 'CORRECTION' || reason === 'TRANSFER' ? (
              <div className="mt-4 space-y-3">
                {reason === 'CORRECTION' ? (
                  <Field label={t('structure.grade')}>
                    <Select
                      value={gradeId}
                      onChange={(e) => {
                        setGradeId(e.target.value);
                        setSectionId('');
                      }}
                    >
                      <option value="">—</option>
                      {grades.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <Field
                  label={`${t('structure.section')}${reason === 'CORRECTION' ? ` (${t('common.optional')})` : ''}`}
                >
                  <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                    <option value="">—</option>
                    {sectionOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('studentProfile.withdrawReason')}>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                {reason === 'CORRECTION' && gradeId && gradeId !== enrollment.grade?.id ? (
                  <p className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
                    {t('studentProfile.gradeChangeFeeWarning')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {redirect ? (
              <p className="mt-4 rounded-md border border-border bg-background/50 px-3 py-2 text-sm text-muted-foreground">
                {t('studentProfile.yearEndRedirect')}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                {t('common.cancel')}
              </Button>
              {reason === 'CORRECTION' || reason === 'TRANSFER' ? (
                <Button type="button" onClick={() => void submit()} disabled={saving}>
                  {saving ? t('common.saving') : t('common.saveChanges')}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Withdraw the student's current enrollment via the enrollment-exit endpoint (Decision 11): an
 * academic event (→ WITHDRAWN) plus a financial settlement. Nothing is deleted; the registration fee
 * and unpaid non-registration charges are settled per the two toggles.
 */
function WithdrawDialog({
  row,
  onClose,
  onDone,
}: {
  row: EnrollmentHistoryRow;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [keepRegistrationFee, setKeepRegistrationFee] = useState(true);
  const [cancelUnpaidCharges, setCancelUnpaidCharges] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await enrollmentExitApi.withdraw(row.id, {
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        cancelUnpaidCharges,
        keepRegistrationFee,
      });
      toast.success(t('studentProfile.withdrawn'));
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Withdraw failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative my-8 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-card"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="font-display text-lg font-semibold">{t('studentProfile.withdrawTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {row.academicYear?.name ?? ''}
          {row.grade ? ` · ${row.grade.nameEn}` : ''}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('studentProfile.withdrawDescription')}
        </p>

        <div className="mt-4 space-y-3">
          <Field label={t('studentProfile.withdrawReason')}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Checkbox
            label={t('studentProfile.keepRegistrationFee')}
            checked={keepRegistrationFee}
            onChange={(e) => setKeepRegistrationFee(e.target.checked)}
          />
          <Checkbox
            label={t('studentProfile.cancelUnpaidCharges')}
            checked={cancelUnpaidCharges}
            onChange={(e) => setCancelUnpaidCharges(e.target.checked)}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? t('common.saving') : t('studentProfile.withdrawConfirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Reactivate a withdrawn enrollment (reverse of withdraw) via the enrollment-exit endpoint: the
 * enrollment returns to ACTIVE for the same year and the charges the withdrawal cancelled are
 * re-opened (paid amounts kept). Nothing is created — the same enrollment/ledger rows are re-instated.
 */
function ReactivateDialog({
  row,
  onClose,
  onDone,
}: {
  row: EnrollmentHistoryRow;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [reopenCharges, setReopenCharges] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await enrollmentExitApi.reactivate(row.id, {
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        reopenCharges,
      });
      toast.success(t('studentProfile.reactivated'));
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reactivate failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative my-8 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-card"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="font-display text-lg font-semibold">
          {t('studentProfile.reactivateTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {row.academicYear?.name ?? ''}
          {row.grade ? ` · ${row.grade.nameEn}` : ''}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('studentProfile.reactivateDescription')}
        </p>

        <div className="mt-4 space-y-3">
          <Field label={t('studentProfile.withdrawReason')}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Checkbox
            label={t('studentProfile.reopenCharges')}
            checked={reopenCharges}
            onChange={(e) => setReopenCharges(e.target.checked)}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? t('common.saving') : t('studentProfile.reactivateConfirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Badge tone for a participation status (Active green, terminal-negative warm, else muted). */
function statusTone(status: string): 'success' | 'warning' | 'danger' | 'muted' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'GRADUATED':
    case 'PROMOTED':
    case 'COMPLETED':
      return 'muted';
    case 'WITHDRAWN':
    case 'CANCELLED':
      return 'danger';
    default:
      return 'muted';
  }
}

/** One before/after row in the fee-impact + confirmation screens (PR 2). */
function ImpactRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-xs text-muted-foreground' : ''}`}>
      <span className={muted ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`text-sm ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
    </div>
  );
}

function Snapshot({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string | undefined;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`font-display text-lg font-semibold ${tone ?? ''}`}>{value}</div>
    </div>
  );
}
