'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EntityPicker,
  Field,
  Input,
  Select,
  useToast,
} from '@axa/platform';
import { useConfirm } from '@/components/confirm';
import { loadParentOptions } from '@/lib/pickers';
import { studentsApi, type Parent, type Student, type StudentParentLink } from '@/lib/people';
import { familiesApi } from '@/lib/families';
import { ParentProfileDialog, ParentEditDialog } from '@/components/domain';

const PARENT_RELATIONS = ['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'];

/**
 * Parents / guardians tab. Lists linked guardians, lets you assign an existing guardian, and
 * opens the shared Parent profile/edit dialogs. Migrated verbatim from the old student modal so
 * the assignment business logic is unchanged.
 */
export function ParentsTab({ student }: { student: Student }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const studentId = student.id;
  const [parents, setParents] = useState<StudentParentLink[]>([]);
  const [parentId, setParentId] = useState('');
  const [relation, setRelation] = useState('FATHER');
  const [viewing, setViewing] = useState<Parent | null>(null);
  const [editing, setEditing] = useState<Parent | null>(null);
  const [busy, setBusy] = useState(false);

  function loadParents() {
    studentsApi
      .parents(studentId)
      .then(setParents)
      .catch(() => undefined);
  }

  useEffect(() => {
    loadParents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!parentId) return;
    setBusy(true);
    try {
      await studentsApi.linkParent(studentId, { parentId, relation });
      setParentId('');
      setRelation('FATHER');
      toast.success(t('people.parentAssigned'));
      loadParents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  }

  async function unlink(pId: string) {
    if (!(await confirm())) return;
    try {
      await studentsApi.unlinkParent(studentId, pId);
      loadParents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    }
  }

  // Explicit, audited billing transfer — opens a dedicated dialog (reason required). Changing the
  // guardian relationship never moves money on its own; this deliberately re-owns the account.
  const [transferTo, setTransferTo] = useState<{ id: string; name: string } | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('people.parents')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {parents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('people.noParents')}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {parents.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="text-start font-medium text-foreground hover:text-primary-strong hover:underline"
                      onClick={() => setViewing(link.parent)}
                    >
                      {link.parent.firstNameEn} {link.parent.lastNameEn}
                    </button>
                    <span className="text-muted-foreground"> · {link.relation}</span>
                    {link.isPrimary ? (
                      <Badge tone="success" className="ms-2">
                        {t('people.primary')}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={link.parent.phone ? `tel:${link.parent.phone}` : undefined}
                      className="font-mono text-xs text-muted-foreground hover:text-foreground"
                    >
                      {link.parent.phone || '—'}
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTransferTo({
                          id: link.parent.id,
                          name: `${link.parent.firstNameEn} ${link.parent.lastNameEn}`.trim(),
                        })
                      }
                    >
                      {t('people.billThrough')}
                    </Button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => void unlink(link.parent.id)}
                      aria-label={`${t('common.delete')} ${link.parent.firstNameEn}`}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={(e) => void assign(e)} className="flex flex-wrap items-end gap-2 pt-1">
            <Field label={t('people.assignParent')} className="min-w-[12rem] flex-1">
              <EntityPicker
                value={parentId}
                onChange={setParentId}
                load={loadParentOptions}
                placeholder={t('people.searchParents')}
              />
            </Field>
            <Field label={t('people.relation')}>
              <Select value={relation} onChange={(e) => setRelation(e.target.value)}>
                {PARENT_RELATIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" size="sm" disabled={!parentId || busy}>
              {busy ? t('common.adding') : t('people.assign')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {viewing ? (
        <ParentProfileDialog
          parent={viewing}
          contextStudent={student}
          onClose={() => setViewing(null)}
          onEdit={() => {
            const p = viewing;
            setViewing(null);
            setEditing(p);
          }}
        />
      ) : null}
      {editing ? (
        <ParentEditDialog
          parent={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadParents();
          }}
        />
      ) : null}
      {transferTo ? (
        <TransferBillingDialog
          studentName={`${student.firstNameEn} ${student.lastNameEn}`.trim()}
          toParent={transferTo}
          onClose={() => setTransferTo(null)}
          onDone={(moved) => {
            setTransferTo(null);
            toast.success(moved ? t('people.billingTransferred') : t('people.billingAlready'));
          }}
          submit={(reason, notes) =>
            familiesApi.transferBilling(studentId, transferTo.id, reason, notes)
          }
        />
      ) : null}
    </>
  );
}

const TRANSFER_REASONS = [
  'PARENT_REQUEST',
  'COURT_ORDER',
  'SECRETARY_CORRECTION',
  'DUPLICATE_ADMISSION_CORRECTION',
  'OTHER',
] as const;

/**
 * Transfer Financial Responsibility — a deliberate, reason-required screen (PR #212 review). Spells out
 * exactly what moves and what does NOT (existing issued invoices are never rewritten). The same
 * StudentFinancialAccount is kept (its owner changes) so balances / account identity / audit chain are
 * preserved.
 */
function TransferBillingDialog({
  studentName,
  toParent,
  onClose,
  onDone,
  submit,
}: {
  studentName: string;
  toParent: { id: string; name: string };
  onClose: () => void;
  onDone: (moved: boolean) => void | Promise<void>;
  submit: (reason: string, notes?: string) => Promise<{ moved: boolean }>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function apply() {
    if (!reason) {
      toast.error(t('people.transferReasonRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await submit(reason, notes.trim() || undefined);
      await onDone(res.moved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
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
        <h2 className="font-display text-lg font-semibold">{t('people.transferTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {studentName} → <span className="font-medium text-foreground">{toParent.name}</span>
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-border p-2">
            <div className="mb-1 font-medium">{t('people.willMove')}</div>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>✓ {t('people.mvAccount')}</li>
              <li>✓ {t('people.mvPlan')}</li>
              <li>✓ {t('people.mvCharges')}</li>
              <li>✓ {t('people.mvPayments')}</li>
              <li>✓ {t('people.mvCredits')}</li>
              <li>✓ {t('people.mvRefunds')}</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border p-2">
            <div className="mb-1 font-medium">{t('people.wontChange')}</div>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>✓ {t('people.ncStudent')}</li>
              <li>✓ {t('people.ncAdmission')}</li>
              <li>✓ {t('people.ncAcademic')}</li>
              <li>✓ {t('people.ncAttendance')}</li>
              <li>✓ {t('people.ncInvoices')}</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-sm font-medium">{t('people.transferReason')}</div>
          {TRANSFER_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="transfer-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
              />
              {t(`people.reason_${r}`)}
            </label>
          ))}
          <Field label={t('people.transferNotes')}>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => void apply()} disabled={saving || !reason}>
            {saving ? t('common.saving') : t('people.transferApply')}
          </Button>
        </div>
      </div>
    </div>
  );
}
