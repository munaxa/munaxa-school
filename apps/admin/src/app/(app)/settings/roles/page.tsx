'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  Field,
  Input,
  Tooltip,
  cn,
  useToast,
} from '@axa/platform';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { useConfirm } from '@/components/confirm';
import { rolesApi, type PermissionCatalogEntry, type RoleSummary } from '@/lib/roles';

/** Imperative handle the parent uses to ask the editor about — and act on — unsaved changes. */
interface RoleEditorHandle {
  isDirty: () => boolean;
  save: () => Promise<boolean>;
}

export default function RolesPage() {
  return (
    <Shell>
      <RolesAdmin />
    </Shell>
  );
}

function RolesAdmin() {
  const toast = useToast();
  const { t } = useI18n();
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const editorRef = useRef<RoleEditorHandle>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([rolesApi.list(), rolesApi.catalog()]);
      setRoles(r);
      setCatalog(c);
      setSelectedId((prev) => prev ?? r[0]?.id ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  function upsertRole(role: RoleSummary) {
    setRoles((prev) => {
      const i = prev.findIndex((r) => r.id === role.id);
      if (i === -1) return [...prev, role];
      const next = [...prev];
      next[i] = role;
      return next;
    });
    setSelectedId(role.id);
  }

  async function createRole() {
    try {
      const role = await rolesApi.create({ nameEn: 'New role', permissions: [] });
      upsertRole(role);
      toast.success('Role created — edit its permissions below');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create role');
    }
  }

  /** Run `action` immediately, unless the open editor has unsaved changes — then prompt first. */
  function withUnsavedGuard(action: () => void) {
    if (editorRef.current?.isDirty()) {
      pendingActionRef.current = action;
      setUnsavedOpen(true);
    } else {
      action();
    }
  }

  function closeUnsavedDialog() {
    setUnsavedOpen(false);
    pendingActionRef.current = null;
  }

  function discardAndContinue() {
    const action = pendingActionRef.current;
    closeUnsavedDialog();
    action?.();
  }

  async function saveAndContinue() {
    setSwitching(true);
    try {
      const ok = await editorRef.current?.save();
      const action = pendingActionRef.current;
      closeUnsavedDialog();
      if (ok) action?.();
    } finally {
      setSwitching(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('roles.loadingRoles')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t('roles.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('roles.subtitle')}</p>
        </div>
        <Button onClick={() => withUnsavedGuard(() => void createRole())}>
          {t('roles.newRole')}
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit">
          <CardContent className="p-2">
            <ul className="space-y-0.5">
              {roles.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => withUnsavedGuard(() => setSelectedId(r.id))}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm transition',
                      r.id === selectedId
                        ? 'bg-secondary/80 font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                    )}
                  >
                    <span className="truncate">{r.nameEn || r.key}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {r.isSystem ? (
                        <Badge tone="muted">{t('common.system')}</Badge>
                      ) : (
                        <Badge tone="default">{t('common.custom')}</Badge>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {selected ? (
          <RoleEditor
            ref={editorRef}
            key={selected.id}
            role={selected}
            catalog={catalog}
            onSaved={upsertRole}
            onDeleted={(id) => {
              setRoles((prev) => prev.filter((r) => r.id !== id));
              setSelectedId(null);
            }}
          />
        ) : (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              {t('roles.selectToEdit')}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={unsavedOpen}
        onClose={closeUnsavedDialog}
        title={t('roles.unsavedTitle')}
        description={t('roles.unsavedBody')}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={closeUnsavedDialog}>
              {t('common.cancel')}
            </Button>
            <Button variant="outline" size="sm" onClick={discardAndContinue}>
              {t('roles.discard')}
            </Button>
            <Button size="sm" onClick={() => void saveAndContinue()} disabled={switching}>
              {switching ? t('common.saving') : t('common.saveChanges')}
            </Button>
          </>
        }
      />
    </div>
  );
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const RoleEditor = forwardRef<
  RoleEditorHandle,
  {
    role: RoleSummary;
    catalog: PermissionCatalogEntry[];
    onSaved: (r: RoleSummary) => void;
    onDeleted: (id: string) => void;
  }
>(function RoleEditor({ role, catalog, onSaved, onDeleted }, ref) {
  const toast = useToast();
  const { t } = useI18n();
  const confirm = useConfirm();
  const [nameEn, setNameEn] = useState(role.nameEn ?? role.key);
  const [nameAr, setNameAr] = useState(role.nameAr ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cloning, setCloning] = useState(false);

  const grouped = useMemo(() => {
    const m = new Map<string, PermissionCatalogEntry[]>();
    for (const p of catalog) {
      const arr = m.get(p.category) ?? [];
      arr.push(p);
      m.set(p.category, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalog]);

  const dirty =
    nameEn !== (role.nameEn ?? role.key) ||
    nameAr !== (role.nameAr ?? '') ||
    selected.size !== role.permissions.length ||
    role.permissions.some((p) => !selected.has(p));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(entries: PermissionCatalogEntry[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of entries) {
        if (on) next.add(e.key);
        else next.delete(e.key);
      }
      return next;
    });
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    try {
      const updated = await rolesApi.update(role.id, {
        nameEn,
        nameAr,
        permissions: [...selected],
      });
      onSaved(updated);
      toast.success('Role saved');
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
      return false;
    } finally {
      setSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({
    isDirty: () => dirty,
    save,
  }));

  async function cloneRole() {
    setCloning(true);
    try {
      const cloned = await rolesApi.create({
        nameEn: `${role.nameEn || role.key} (Copy)`,
        ...(role.nameAr ? { nameAr: `${role.nameAr} (نسخة)` } : {}),
        permissions: role.permissions,
      });
      onSaved(cloned);
      toast.success('Role cloned — edit its permissions below');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to clone role');
    } finally {
      setCloning(false);
    }
  }

  async function remove() {
    if (!(await confirm({ description: `Delete the “${nameEn}” role? This cannot be undone.` })))
      return;
    setDeleting(true);
    try {
      await rolesApi.remove(role.id);
      onDeleted(role.id);
      toast.success('Role deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {role.nameEn || role.key}
              {role.isSystem ? (
                <Badge tone="muted">{t('common.system')}</Badge>
              ) : (
                <Badge tone="default">{t('common.custom')}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              <span className="font-mono text-xs">{role.key}</span> · {role.userCount}{' '}
              {role.userCount === 1 ? t('roles.userSuffix') : t('roles.usersSuffix')} ·{' '}
              {selected.size}{' '}
              {selected.size === 1 ? t('roles.permissionSuffix') : t('roles.permissionsSuffix')}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void cloneRole()} disabled={cloning}>
              {cloning ? t('roles.cloning') : t('roles.clone')}
            </Button>
            {!role.isSystem ? (
              <Button variant="outline" size="sm" onClick={() => void remove()} disabled={deleting}>
                {t('common.delete')}
              </Button>
            ) : null}
            <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
              {saving ? t('common.saving') : t('common.saveChanges')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('roles.nameEn')}>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </Field>
          <Field label={t('roles.nameAr')}>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
          </Field>
        </div>

        {role.isSystem ? (
          <p className="rounded-lg border border-border bg-secondary/30 p-2 text-xs text-muted-foreground">
            {t('roles.builtInNote')}
          </p>
        ) : null}

        <div className="space-y-4">
          {grouped.map(([category, entries]) => {
            const allOn = entries.every((e) => selected.has(e.key));
            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold">{titleCase(category)}</h3>
                  <button
                    type="button"
                    className="text-xs text-primary-strong hover:underline"
                    onClick={() => toggleGroup(entries, !allOn)}
                  >
                    {allOn ? t('roles.clear') : t('roles.selectAll')}
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {entries.map((p) => (
                    <label
                      key={p.key}
                      className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2 text-sm hover:bg-secondary/40"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={selected.has(p.key)}
                        onChange={() => toggle(p.key)}
                      />
                      {p.description ? (
                        <Tooltip
                          content={p.description}
                          className="w-56 whitespace-normal text-start"
                        >
                          <span className="font-mono text-xs">{p.key}</span>
                        </Tooltip>
                      ) : (
                        <span className="font-mono text-xs">{p.key}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});
