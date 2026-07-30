'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { usePrincipal } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  DatePicker,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@axa/platform';
import {
  documentsApi,
  type AgreementStatus,
  type DocumentAccessLog,
  type DocumentMeta,
  type DocumentType,
  type DocumentLanguage,
  type EmailDocumentInput,
  type RegistrationAgreementRow,
} from '@/lib/documents';

const LANGUAGES: DocumentLanguage[] = ['EN', 'AR', 'BILINGUAL'];

/** Finance document types the registrar/finance officer can generate on demand from this screen. */
const GENERATABLE: DocumentType[] = [
  'ACCOUNT_STATEMENT',
  'PAYMENT_HISTORY',
  'FEE_BREAKDOWN',
  'STUDENT_FINANCIAL_SUMMARY',
  'OUTSTANDING_BALANCE_CERTIFICATE',
  'CLEARANCE_CERTIFICATE',
  'ANNUAL_TUITION_CERTIFICATE',
];

/** Recent calendar years offered for the Annual Tuition Certificate (current year first). */
const CERT_YEARS: number[] = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i);

const dateStr = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '—');
const docNo = (n: number) => String(n).padStart(6, '0');

/** Badge tone for the agreement's (derived) lifecycle status. */
const AGREEMENT_TONE: Record<AgreementStatus, 'success' | 'muted' | 'warning' | 'danger'> = {
  SIGNED: 'success',
  PRINTED: 'warning',
  GENERATED: 'muted',
  COMMITTED: 'muted',
  DRAFT: 'muted',
  CANCELLED: 'danger',
  ARCHIVED: 'muted',
};

const ACCEPT_SIGNED = 'application/pdf,image/jpeg,image/png';

/**
 * Student Finance Card → Documents (Part 5). Lists the immutable document archive and the
 * registration agreement(s), and lets staff generate the finance documents on demand. Every action
 * goes through the Document Engine API (which renders from the ledger, archives, and audits) — this
 * screen never computes or stores any financial figure itself.
 */
export function DocumentsSection({ studentId }: { studentId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const principal = usePrincipal();
  const can = (p: string) => principal.permissions.includes(p);
  const canUploadSigned = can('document:upload_signed');
  const canReplaceSigned = can('document:replace_signed');
  const canDeleteSigned = can('document:delete_signed');
  const canGenerateAgreement = can('document:generate');

  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [agreements, setAgreements] = useState<RegistrationAgreementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Language the registration agreement is (re)generated in — bilingual (Arabic + English) default.
  const [agreementLang, setAgreementLang] = useState<DocumentLanguage>('BILINGUAL');
  const [language, setLanguage] = useState<DocumentLanguage>('EN');
  // Calendar year to certify on the Annual Tuition Certificate (defaults to the current year).
  const [certYear, setCertYear] = useState<number>(new Date().getFullYear());

  // Email dialog state.
  const [emailDoc, setEmailDoc] = useState<DocumentMeta | null>(null);
  const [emailForm, setEmailForm] = useState({
    includePrimaryParent: true,
    includeSecondaryParent: false,
    includeGuardian: false,
    to: '',
    cc: '',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);

  // Access-history dialog state.
  const [historyDoc, setHistoryDoc] = useState<DocumentMeta | null>(null);
  const [history, setHistory] = useState<DocumentAccessLog[] | null>(null);

  // Signed-agreement upload/replace dialog state.
  const fileRef = useRef<HTMLInputElement>(null);
  const [signAgreement, setSignAgreement] = useState<RegistrationAgreementRow | null>(null);
  const [signReplace, setSignReplace] = useState(false);
  const [signForm, setSignForm] = useState({
    signedBy: '',
    signedAt: '',
    file: null as File | null,
  });
  const [signing, setSigning] = useState(false);
  const [deleteSignedFor, setDeleteSignedFor] = useState<RegistrationAgreementRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([
        documentsApi.list(studentId),
        documentsApi.listAgreements(studentId).catch(() => []),
      ]);
      setDocs(d);
      setAgreements(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const typeLabel = (type: DocumentType) =>
    t(`studentProfile.docTypes.${type}`) || type.replace(/_/g, ' ');

  async function generate(type: DocumentType) {
    if (type === 'ANNUAL_TUITION_CERTIFICATE' && !certYear) {
      toast.error(t('studentProfile.selectYear'));
      return;
    }
    setBusy(type);
    try {
      await documentsApi.generate({
        type,
        studentId,
        language,
        ...(type === 'ANNUAL_TUITION_CERTIFICATE' ? { year: certYear } : {}),
      });
      toast.success(t('studentProfile.documentGenerated'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(null);
    }
  }

  async function regenerateAgreement(agreement: RegistrationAgreementRow) {
    await withBusy(`regen-${agreement.id}`, async () => {
      await documentsApi.generateAgreement(agreement.enrollmentId, agreementLang);
      toast.success(t('studentProfile.agreementRegenerated'));
      await load();
    });
  }

  function openSign(agreement: RegistrationAgreementRow, replace: boolean) {
    setSignReplace(replace);
    setSignForm({ signedBy: '', signedAt: '', file: null });
    setSignAgreement(agreement);
  }

  async function submitSigned() {
    if (!signAgreement || !signForm.file) {
      toast.error(t('studentProfile.selectFile'));
      return;
    }
    setSigning(true);
    try {
      await documentsApi.uploadSignedAgreement(signAgreement.id, signForm.file, {
        ...(signForm.signedBy.trim() ? { signedBy: signForm.signedBy.trim() } : {}),
        ...(signForm.signedAt ? { signedAt: signForm.signedAt } : {}),
        replace: signReplace,
      });
      toast.success(t('studentProfile.signedUploaded'));
      setSignAgreement(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setSigning(false);
    }
  }

  async function confirmDeleteSigned() {
    if (!deleteSignedFor) return;
    await withBusy(`del-signed-${deleteSignedFor.id}`, async () => {
      await documentsApi.deleteSignedAgreement(deleteSignedFor.id);
      toast.success(t('studentProfile.signedDeleted'));
      setDeleteSignedFor(null);
      await load();
    });
  }

  async function withBusy(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  function openEmail(doc: DocumentMeta) {
    setEmailForm({
      includePrimaryParent: true,
      includeSecondaryParent: false,
      includeGuardian: false,
      to: '',
      cc: '',
      subject: '',
      message: '',
    });
    setEmailDoc(doc);
  }

  async function sendEmail() {
    if (!emailDoc) return;
    const split = (v: string) =>
      v
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    const input: EmailDocumentInput = {
      includePrimaryParent: emailForm.includePrimaryParent,
      includeSecondaryParent: emailForm.includeSecondaryParent,
      includeGuardian: emailForm.includeGuardian,
      ...(split(emailForm.to).length ? { to: split(emailForm.to) } : {}),
      ...(split(emailForm.cc).length ? { cc: split(emailForm.cc) } : {}),
      ...(emailForm.subject.trim() ? { subject: emailForm.subject.trim() } : {}),
      ...(emailForm.message.trim() ? { message: emailForm.message.trim() } : {}),
    };
    setSending(true);
    try {
      await documentsApi.email(emailDoc.id, input);
      toast.success(t('studentProfile.documentEmailed'));
      setEmailDoc(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Email failed');
    } finally {
      setSending(false);
    }
  }

  async function openHistory(doc: DocumentMeta) {
    setHistoryDoc(doc);
    setHistory(null);
    try {
      setHistory(await documentsApi.history(doc.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load history');
      setHistory([]);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Registration Agreement (legal commitment, auto-generated at registration) */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <CardTitle>{t('studentProfile.docTypes.REGISTRATION_AGREEMENT')}</CardTitle>
            {canGenerateAgreement && agreements.length > 0 ? (
              <Field label={t('studentProfile.agreementLanguage')}>
                <Select
                  value={agreementLang}
                  onChange={(e) => setAgreementLang(e.target.value as DocumentLanguage)}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {agreements.length === 0 ? (
            <div className="p-4">
              <EmptyState title={t('studentProfile.noAgreements')} />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t('studentProfile.agreementNo')}</TH>
                  <TH>{t('common.status')}</TH>
                  <TH>{t('studentProfile.createdAt')}</TH>
                  <TH className="text-end">{t('studentProfile.printed')}</TH>
                  <TH>{t('studentProfile.signed')}</TH>
                  <TH className="text-end">{t('finance.amount')}</TH>
                  <TH className="text-end">{t('common.actions')}</TH>
                </TR>
              </THead>
              <TBody>
                {agreements.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-mono text-xs">AGR-{docNo(a.agreementNo)}</TD>
                    <TD>
                      <Badge tone={AGREEMENT_TONE[a.effectiveStatus] ?? 'muted'}>
                        {a.effectiveStatus}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap font-mono text-xs">{dateStr(a.createdAt)}</TD>
                    <TD className="text-end font-mono text-xs">
                      {a.printedCount}
                      {a.lastPrintedAt ? (
                        <span className="block text-[10px] text-muted-foreground">
                          {dateStr(a.lastPrintedAt)}
                        </span>
                      ) : null}
                    </TD>
                    <TD className="text-xs">
                      {a.hasSigned ? (
                        <>
                          <span className="font-mono">{dateStr(a.signedAt)}</span>
                          {a.signedBy ? <span className="block">{a.signedBy}</span> : null}
                          {a.signedUploadedByName ? (
                            <span className="block text-[10px] text-muted-foreground">
                              {t('studentProfile.uploadedBy')}: {a.signedUploadedByName}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TD>
                    <TD className="text-end font-mono">{Number(a.grandTotal).toFixed(3)}</TD>
                    <TD className="text-end">
                      <div className="flex flex-wrap justify-end gap-1">
                        {a.documentId ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy !== null}
                              onClick={() =>
                                void withBusy(`dl-${a.documentId}`, () =>
                                  documentsApi.download(a.documentId!),
                                )
                              }
                            >
                              {t('studentProfile.download')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy !== null}
                              onClick={() =>
                                void withBusy(`pr-${a.documentId}`, () =>
                                  documentsApi.print(a.documentId!),
                                )
                              }
                            >
                              {t('studentProfile.printReceipt')}
                            </Button>
                          </>
                        ) : null}
                        {a.hasSigned ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy !== null}
                            onClick={() =>
                              void withBusy(`view-signed-${a.id}`, () =>
                                documentsApi.viewSignedAgreement(a.id),
                              )
                            }
                          >
                            {t('studentProfile.viewSigned')}
                          </Button>
                        ) : null}
                        {canGenerateAgreement ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy !== null}
                            onClick={() => void regenerateAgreement(a)}
                          >
                            {busy === `regen-${a.id}`
                              ? t('common.recording')
                              : t('studentProfile.regenerateAgreement')}
                          </Button>
                        ) : null}
                        {!a.hasSigned && canUploadSigned ? (
                          <Button size="sm" variant="ghost" onClick={() => openSign(a, false)}>
                            {t('studentProfile.uploadSigned')}
                          </Button>
                        ) : null}
                        {a.hasSigned && canReplaceSigned ? (
                          <Button size="sm" variant="ghost" onClick={() => openSign(a, true)}>
                            {t('studentProfile.replaceSigned')}
                          </Button>
                        ) : null}
                        {a.hasSigned && canDeleteSigned ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-danger/40 text-danger hover:bg-danger/10"
                            onClick={() => setDeleteSignedFor(a)}
                          >
                            {t('common.delete')}
                          </Button>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate finance documents */}
      <Card>
        <CardHeader>
          <CardTitle>{t('studentProfile.generateDocument')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('studentProfile.language')}>
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value as DocumentLanguage)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            {/* Calendar year (1 Jan – 31 Dec) certified by the Annual Tuition Certificate. */}
            <Field label={t('studentProfile.tuitionYear')}>
              <Select
                value={String(certYear)}
                onChange={(e) => setCertYear(Number(e.target.value))}
              >
                {CERT_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            {GENERATABLE.map((type) => (
              <Button
                key={type}
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void generate(type)}
              >
                {busy === type ? t('common.recording') : typeLabel(type)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Document archive */}
      <Card>
        <CardHeader>
          <CardTitle>{t('studentProfile.documentsArchive')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>{t('studentProfile.documentType')}</TH>
                <TH>{t('studentProfile.receiptNo')}</TH>
                <TH>{t('studentProfile.language')}</TH>
                <TH className="text-end">{t('studentProfile.printed')}</TH>
                <TH className="text-end">{t('studentProfile.downloaded')}</TH>
                <TH className="text-end">{t('studentProfile.emailed')}</TH>
                <TH>{t('studentProfile.generatedAt')}</TH>
                <TH className="text-end">{t('common.actions')}</TH>
              </TR>
            </THead>
            <TBody>
              {docs.map((d) => (
                <TR key={d.id}>
                  <TD>
                    {typeLabel(d.type)}
                    <Badge
                      tone={d.persistence === 'SNAPSHOT' ? 'success' : 'muted'}
                      className="ms-2"
                    >
                      {d.persistence}
                    </Badge>
                    {d.status !== 'ARCHIVED' ? (
                      <Badge tone="muted" className="ms-2">
                        {d.status}
                      </Badge>
                    ) : null}
                  </TD>
                  <TD className="font-mono text-xs">DOC-{docNo(d.documentNo)}</TD>
                  <TD className="font-mono text-xs">{d.language}</TD>
                  <TD className="text-end font-mono">{d.printedCount}</TD>
                  <TD className="text-end font-mono">{d.downloadCount}</TD>
                  <TD className="text-end font-mono">{d.emailCount}</TD>
                  <TD className="whitespace-nowrap font-mono text-xs">{dateStr(d.generatedAt)}</TD>
                  <TD className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() =>
                          void withBusy(`dl-${d.id}`, () => documentsApi.download(d.id))
                        }
                      >
                        {t('studentProfile.download')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => void withBusy(`pr-${d.id}`, () => documentsApi.print(d.id))}
                      >
                        {t('studentProfile.printReceipt')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEmail(d)}>
                        {t('studentProfile.emailDocument')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void openHistory(d)}>
                        {t('studentProfile.accessHistory')}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
              {docs.length === 0 ? (
                <TR>
                  <TD colSpan={8}>
                    <EmptyState title={t('studentProfile.noDocuments')} />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Email dialog */}
      <Dialog
        open={emailDoc !== null}
        onClose={() => setEmailDoc(null)}
        title={t('studentProfile.emailDocument')}
        description={emailDoc?.title ?? ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEmailDoc(null)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" disabled={sending} onClick={() => void sendEmail()}>
              {sending ? t('common.recording') : t('studentProfile.sendEmail')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Checkbox
              label={t('studentProfile.primaryParent')}
              checked={emailForm.includePrimaryParent}
              onChange={(e) =>
                setEmailForm({ ...emailForm, includePrimaryParent: e.target.checked })
              }
            />
            <Checkbox
              label={t('studentProfile.secondaryParent')}
              checked={emailForm.includeSecondaryParent}
              onChange={(e) =>
                setEmailForm({ ...emailForm, includeSecondaryParent: e.target.checked })
              }
            />
            <Checkbox
              label={t('studentProfile.guardian')}
              checked={emailForm.includeGuardian}
              onChange={(e) => setEmailForm({ ...emailForm, includeGuardian: e.target.checked })}
            />
          </div>
          <Field label={t('studentProfile.customEmails')}>
            <Input
              value={emailForm.to}
              placeholder="a@example.com, b@example.com"
              onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
            />
          </Field>
          <Field label="CC">
            <Input
              value={emailForm.cc}
              onChange={(e) => setEmailForm({ ...emailForm, cc: e.target.value })}
            />
          </Field>
          <Field label={t('studentProfile.subject')}>
            <Input
              value={emailForm.subject}
              onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
            />
          </Field>
          <Field label={t('studentProfile.message')}>
            <Input
              value={emailForm.message}
              onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
            />
          </Field>
        </div>
      </Dialog>

      {/* Access-history dialog */}
      <Dialog
        open={historyDoc !== null}
        onClose={() => setHistoryDoc(null)}
        title={t('studentProfile.accessHistory')}
        description={historyDoc?.title ?? ''}
      >
        {history === null ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : history.length === 0 ? (
          <EmptyState title={t('studentProfile.noDocuments')} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('common.actions')}</TH>
                <TH>{t('common.status')}</TH>
                <TH>{t('finance.date')}</TH>
              </TR>
            </THead>
            <TBody>
              {history.map((h) => (
                <TR key={h.id}>
                  <TD>{h.action}</TD>
                  <TD>
                    <Badge tone={h.status === 'SUCCESS' ? 'success' : 'danger'}>{h.status}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap font-mono text-xs">
                    {new Date(h.createdAt).toLocaleString()}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Dialog>

      {/* Upload / replace signed agreement dialog */}
      <Dialog
        open={signAgreement !== null}
        onClose={() => setSignAgreement(null)}
        title={signReplace ? t('studentProfile.replaceSigned') : t('studentProfile.uploadSigned')}
        description={signAgreement ? `AGR-${docNo(signAgreement.agreementNo)}` : ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSignAgreement(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              disabled={signing || !signForm.file}
              onClick={() => void submitSigned()}
            >
              {signing ? t('common.recording') : t('studentProfile.upload')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label={t('studentProfile.signedFile')}>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_SIGNED}
              className="block w-full text-sm"
              onChange={(e) => setSignForm({ ...signForm, file: e.target.files?.[0] ?? null })}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              {t('studentProfile.signedFileHint')}
            </p>
          </Field>
          <Field label={t('studentProfile.signedByName')}>
            <Input
              value={signForm.signedBy}
              onChange={(e) => setSignForm({ ...signForm, signedBy: e.target.value })}
            />
          </Field>
          <Field label={t('studentProfile.signedDate')}>
            <DatePicker
              value={signForm.signedAt}
              onChange={(value) => setSignForm({ ...signForm, signedAt: value })}
            />
          </Field>
        </div>
      </Dialog>

      {/* Delete signed agreement confirm */}
      <Dialog
        open={deleteSignedFor !== null}
        onClose={() => setDeleteSignedFor(null)}
        title={t('studentProfile.deleteSignedTitle')}
        description={deleteSignedFor ? `AGR-${docNo(deleteSignedFor.agreementNo)}` : ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteSignedFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              className="bg-danger text-white"
              disabled={busy !== null}
              onClick={() => void confirmDeleteSigned()}
            >
              {t('common.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">{t('studentProfile.deleteSignedConfirm')}</p>
      </Dialog>
    </div>
  );
}
