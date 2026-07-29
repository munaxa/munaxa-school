'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Select,
  Spinner,
  useToast,
} from '@axa/platform';
import { useI18n } from '@/components/i18n-provider';
import {
  attendanceSettingsApi,
  type AttendanceSettings,
  type AttendanceSourceMode,
  type TransportMethod,
} from '@/lib/attendance-settings';

const MODES: { value: AttendanceSourceMode; labelKey: string; helpKey: string }[] = [
  {
    value: 'TEACHER_ONLY',
    labelKey: 'settingsAttendance.teacherOnly',
    helpKey: 'settingsAttendance.teacherOnlyHelp',
  },
  {
    value: 'GATE_ARRIVAL',
    labelKey: 'settingsAttendance.gateArrival',
    helpKey: 'settingsAttendance.gateArrivalHelp',
  },
  {
    value: 'BUS_ARRIVAL',
    labelKey: 'settingsAttendance.busArrival',
    helpKey: 'settingsAttendance.busArrivalHelp',
  },
  {
    value: 'HYBRID',
    labelKey: 'settingsAttendance.hybrid',
    helpKey: 'settingsAttendance.hybridHelp',
  },
];
const BUS_METHODS: TransportMethod[] = ['NFC', 'RFID', 'QR', 'MANUAL'];

export default function AttendanceSettingsPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setSettings(await attendanceSettingsApi.get());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Partial<AttendanceSettings>) {
    try {
      setSettings(await attendanceSettingsApi.update(patch));
      toast.success('Saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  if (loading) {
    return (
      <Shell>
        <Spinner />
      </Shell>
    );
  }
  if (!settings) return <Shell>{null}</Shell>;
  const s = settings;

  return (
    <Shell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t('settingsAttendance.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('settingsAttendance.subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('settingsAttendance.source')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t('settingsAttendance.sourceMode')}>
              <Select
                value={s.mode}
                onChange={(e) => void save({ mode: e.target.value as AttendanceSourceMode })}
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {t(m.labelKey)}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-muted-foreground">
              {(() => {
                const mode = MODES.find((m) => m.value === s.mode);
                return mode ? t(mode.helpKey) : '';
              })()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settingsAttendance.modules')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('settingsAttendance.presenceTracking')}>
                <Select
                  value={s.presenceEnabled ? 'on' : 'off'}
                  onChange={(e) => void save({ presenceEnabled: e.target.value === 'on' })}
                >
                  <option value="off">{t('settingsAttendance.off')}</option>
                  <option value="on">{t('settingsAttendance.on')}</option>
                </Select>
              </Field>
              <Field label={t('settingsAttendance.transportTracking')}>
                <Select
                  value={s.transportEnabled ? 'on' : 'off'}
                  onChange={(e) => void save({ transportEnabled: e.target.value === 'on' })}
                >
                  <option value="off">{t('settingsAttendance.off')}</option>
                  <option value="on">{t('settingsAttendance.on')}</option>
                </Select>
              </Field>
              <Field label={t('settingsAttendance.busMethod')}>
                <Select
                  value={s.busMethod}
                  onChange={(e) => void save({ busMethod: e.target.value as TransportMethod })}
                >
                  {BUS_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">{t('settingsAttendance.busMethodHelp')}</p>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
