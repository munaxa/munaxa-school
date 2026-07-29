'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  useToast,
} from '@axa/platform';
import {
  admissionsApi,
  type IdentityLookupResult,
  type IdentityStudentSummary,
} from '@/lib/admissions';

/**
 * Identity-first admission entry (Decision — one Admission; A/B/C). National ID is the primary lookup,
 * Ministry number the fallback; the match is EXACT (never fuzzy). The similar-name box is an
 * informational warning ONLY — it never blocks and is never the identity check.
 */
export default function AdmissionIdentityPage() {
  const { t } = useI18n();
  const toast = useToast();

  const [name, setName] = useState('');
  const [similar, setSimilar] = useState<IdentityStudentSummary[]>([]);
  const [nationalId, setNationalId] = useState('');
  const [moeStudentNumber, setMoe] = useState('');
  const [result, setResult] = useState<IdentityLookupResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Informational similar-name warning (debounced-ish on blur), never used as the identity check.
  async function checkSimilar(value: string) {
    setName(value);
    if (value.trim().length < 2) {
      setSimilar([]);
      return;
    }
    try {
      setSimilar(await admissionsApi.identitySimilar(value));
    } catch {
      setSimilar([]);
    }
  }

  async function lookup() {
    if (!nationalId.trim() && !moeStudentNumber.trim()) {
      toast.error(t('admissionsIdentity.needIdentifier'));
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      setResult(
        await admissionsApi.identityLookup({
          ...(nationalId.trim() ? { nationalId: nationalId.trim() } : {}),
          ...(moeStudentNumber.trim() ? { moeStudentNumber: moeStudentNumber.trim() } : {}),
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('admissionsIdentity.lookupFailed'));
    } finally {
      setLoading(false);
    }
  }

  const fullName = (s: IdentityStudentSummary) => `${s.firstNameEn} ${s.lastNameEn}`.trim();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">{t('admissionsIdentity.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admissionsIdentity.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admissionsIdentity.identity')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Informational similar-name warning — shown BEFORE the identifier, never blocking. */}
          <Field label={t('admissionsIdentity.name')}>
            <Input
              value={name}
              onChange={(e) => void checkSimilar(e.target.value)}
              placeholder={t('admissionsIdentity.namePlaceholder')}
            />
          </Field>
          {similar.length > 0 ? (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
              <div className="mb-1 font-medium text-warning">
                {t('admissionsIdentity.similarWarning')}
              </div>
              <ul className="space-y-1">
                {similar.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span>
                      {fullName(s)}
                      <span className="text-muted-foreground">
                        {s.studentNumber ? ` · ${s.studentNumber}` : ''}
                        {s.nationalId ? ` · ${s.nationalId}` : ''}
                      </span>
                    </span>
                    <Link
                      href={`/people/students/${s.id}`}
                      className="text-xs text-primary-strong hover:underline"
                    >
                      {t('admissionsIdentity.openStudent')}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('admissionsIdentity.nationalId')}>
              <Input
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder={t('admissionsIdentity.nationalIdPlaceholder')}
              />
            </Field>
            <Field label={t('admissionsIdentity.ministryNo')}>
              <Input value={moeStudentNumber} onChange={(e) => setMoe(e.target.value)} />
            </Field>
          </div>
          <Button onClick={() => void lookup()} disabled={loading}>
            {loading ? t('admissionsIdentity.checking') : t('admissionsIdentity.check')}
          </Button>
        </CardContent>
      </Card>

      {result ? <ResultCard result={result} t={t} fullName={fullName} /> : null}
    </div>
  );
}

function ResultCard({
  result,
  t,
  fullName,
}: {
  result: IdentityLookupResult;
  t: (k: string) => string;
  fullName: (s: IdentityStudentSummary) => string;
}) {
  // CASE A — NEW: no student found → proceed with a normal admission.
  if (result.case === 'NEW' || !result.student) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('admissionsIdentity.caseNewTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('admissionsIdentity.caseNewBody')}</p>
          <Link href="/admissions">
            <Button>{t('admissionsIdentity.startAdmission')}</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const s = result.student;
  const isActive = result.case === 'ACTIVE';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isActive
            ? t('admissionsIdentity.caseActiveTitle')
            : t('admissionsIdentity.caseReturningTitle')}
          <Badge tone={isActive ? 'success' : 'warning'}>{result.case.toLowerCase()}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          <div className="font-medium">
            {fullName(s)}
            <span className="text-muted-foreground">
              {s.studentNumber ? ` · ${s.studentNumber}` : ''}
            </span>
          </div>
          {result.currentEnrollment ? (
            <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {result.currentEnrollment.academicYearName} · {result.currentEnrollment.gradeName} ·{' '}
              {result.currentEnrollment.status.toLowerCase()}
            </div>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          {isActive
            ? t('admissionsIdentity.caseActiveBody')
            : t('admissionsIdentity.caseReturningBody')}
        </p>

        <div className="flex flex-wrap gap-2">
          <Link href={`/people/students/${s.id}`}>
            <Button variant="outline">{t('admissionsIdentity.openStudent')}</Button>
          </Link>
          <Link href="/finance/families">
            <Button variant="outline">{t('admissionsIdentity.openFinancialAccount')}</Button>
          </Link>
          {!isActive ? (
            // CASE C — RETURNING: re-enrol (never a new Student). Launches the admission flow with the
            // existing student; the shared pipeline creates the new-year enrollment.
            <Link href={`/admissions?returningStudentId=${s.id}`}>
              <Button>{t('admissionsIdentity.reEnroll')}</Button>
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
