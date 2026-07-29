'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { useConfirm } from '@/components/confirm';
import { schoolsApi, campusesApi, type School, type Campus } from '@/lib/structure';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@axa/platform';

export default function SchoolsPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [schools, setSchools] = useState<School[]>([]);
  const [selected, setSelected] = useState<School | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setSchools(await schoolsApi.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-display text-2xl font-semibold">{t('nav.structure')}</h1>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('structure.schools')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CreateSchool onCreated={load} onError={setError} />
            <ul className="divide-y divide-border rounded-lg border border-border">
              {schools.map((s) => (
                <li key={s.id} className="flex items-center justify-between p-3">
                  <button type="button" className="text-start" onClick={() => setSelected(s)}>
                    <span className="font-medium">{s.nameEn}</span>{' '}
                    <span className="text-muted-foreground" dir="rtl">
                      · {s.nameAr}
                    </span>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() =>
                      void confirm().then((ok) => {
                        if (ok) void schoolsApi.remove(s.id).then(load);
                      })
                    }
                  >
                    {t('common.delete')}
                  </Button>
                </li>
              ))}
              {schools.length === 0 ? (
                <li className="p-3 text-sm text-muted-foreground">{t('structure.noSchools')}</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        {selected ? <Campuses school={selected} onError={setError} /> : null}
      </div>
    </Shell>
  );
}

function CreateSchool({
  onCreated,
  onError,
}: {
  onCreated: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { t } = useI18n();
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await schoolsApi.create({ nameEn, nameAr });
      setNameEn('');
      setNameAr('');
      await onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-wrap gap-2">
      <Input
        className="flex-1"
        placeholder={t('structure.nameEnPlaceholder')}
        value={nameEn}
        onChange={(e) => setNameEn(e.target.value)}
        required
      />
      <Input
        className="flex-1"
        placeholder="الاسم (AR)"
        value={nameAr}
        onChange={(e) => setNameAr(e.target.value)}
        required
        dir="rtl"
      />
      <Button type="submit">{t('structure.addSchool')}</Button>
    </form>
  );
}

function Campuses({ school, onError }: { school: School; onError: (m: string) => void }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');

  const load = useCallback(async () => {
    try {
      setCampuses(await campusesApi.list(school.id));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load campuses');
    }
  }, [school.id, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await campusesApi.create({ schoolId: school.id, nameEn, nameAr });
      setNameEn('');
      setNameAr('');
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('structure.campuses')} · {school.nameEn}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={(e) => void submit(e)} className="flex flex-wrap gap-2">
          <Input
            className="flex-1"
            placeholder={t('structure.campusEnPlaceholder')}
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            required
          />
          <Input
            className="flex-1"
            placeholder="الحرم (AR)"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            required
            dir="rtl"
          />
          <Button type="submit">{t('structure.addCampus')}</Button>
        </form>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {campuses.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-3">
              <span>
                {c.nameEn} <span dir="rtl">· {c.nameAr}</span>
                {c.isMain ? (
                  <Badge tone="success" className="ms-2">
                    {t('structure.main')}
                  </Badge>
                ) : null}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() =>
                  void confirm().then((ok) => {
                    if (ok) void campusesApi.remove(c.id).then(load);
                  })
                }
              >
                {t('common.delete')}
              </Button>
            </li>
          ))}
          {campuses.length === 0 ? (
            <li className="p-3 text-sm text-muted-foreground">{t('structure.noCampuses')}</li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
}
