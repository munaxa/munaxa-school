'use client';

import { Button, TimePicker } from '@munaxa/ui';
import { useI18n } from '@/components/i18n-provider';

/** How far one press of − / + moves the clock. A school bell moves in minutes, not half hours. */
const STEP_MINUTES = 5;
const MINUTES_PER_DAY = 24 * 60;

interface TimeCounterProps {
  /** Wire format — `HH:mm` on a 24-hour clock. */
  value: string;
  onChange: (value: string) => void;
  /** Minutes one press of − / + moves. Also the granularity of the picker's own list. */
  stepMinutes?: number;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * A time field you can count up and down, rather than pick off a list of fixed slots.
 *
 * The platform `TimePicker` offers times every 30 minutes by default, which is the wrong shape for
 * a timetable: a period runs 08:00–08:45 and the next one starts at 08:50, so every real class
 * lands between two of the offered slots. The picker still does the typing, parsing and locale
 * work — this only wraps it in a counter, and tightens its list to the same step, so nudging a
 * lesson five minutes is one press instead of a retype.
 */
export function TimeCounter({
  value,
  onChange,
  stepMinutes = STEP_MINUTES,
  disabled,
  'aria-label': ariaLabel,
}: TimeCounterProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled ?? false}
        aria-label={t('timetable.timeEarlier')}
        onClick={() => onChange(shiftTime(value, -stepMinutes))}
      >
        <span aria-hidden="true">−</span>
      </Button>
      <TimePicker
        value={value}
        onChange={onChange}
        step={stepMinutes}
        className="flex-1"
        disabled={disabled ?? false}
        {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled ?? false}
        aria-label={t('timetable.timeLater')}
        onClick={() => onChange(shiftTime(value, stepMinutes))}
      >
        <span aria-hidden="true">+</span>
      </Button>
    </div>
  );
}

/** Move an `HH:mm` value by whole minutes, wrapping within the day so the field is never invalid. */
export function shiftTime(value: string, deltaMinutes: number): string {
  const minutes = toMinutes(value);
  const next = (((minutes + deltaMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return formatMinutes(next);
}

/** Minutes between two `HH:mm` values, as a positive duration within the same day. */
export function minutesBetween(start: string, end: string): number {
  const span = toMinutes(end) - toMinutes(start);
  return span > 0 ? span : 0;
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':');
  const h = Number(hours);
  const m = Number(minutes);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
