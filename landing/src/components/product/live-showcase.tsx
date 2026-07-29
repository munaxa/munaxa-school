'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { AppFrame } from './app-frame';
import { DashboardPreview } from './dashboard-preview';
import { AdmissionsBoard } from './admissions-board';
import { FinanceWorkspace } from './finance-workspace';
import { IntelligencePanel } from './intelligence-panel';
import { cn } from '@axa/platform';

type View = { key: string; label: string; url: string; Node: ComponentType };

const VIEWS: View[] = [
  { key: 'dashboard', label: 'Dashboard', url: 'app.munaxa.com/dashboard', Node: DashboardPreview },
  { key: 'admissions', label: 'Admissions', url: 'app.munaxa.com/admissions', Node: AdmissionsBoard },
  { key: 'finance', label: 'Finance', url: 'app.munaxa.com/finance', Node: FinanceWorkspace },
  { key: 'reports', label: 'Reports', url: 'app.munaxa.com/reports', Node: IntelligencePanel },
];

// The activity feed rotates believable, in-product events — the operating system "breathing".
const ACTIVITY = [
  { tone: 'cool', text: 'Payment received · Al-Masri family · JOD 1,850' },
  { tone: 'warm', text: 'New application · Yousef Haddad · Grade 6' },
  { tone: 'cool', text: 'Report cards published · Grades 7–9' },
  { tone: 'muted', text: 'Bus route 4 · on time · 28 students' },
  { tone: 'cool', text: 'Attendance recorded · 96.4% present' },
] as const;

const ADVANCE_MS = 4200;
const ACTIVITY_MS = 2800;

/**
 * The hero product surface, made to feel alive. It cycles through real product views with a quiet
 * crossfade and surfaces a rotating activity feed — the same information the school sees. Visitors
 * can click a tab to jump. Fully static (dashboard, no motion) under prefers-reduced-motion.
 */
export function LiveShowcase() {
  const [active, setActive] = useState(0);
  const [activity, setActivity] = useState(0);
  const paused = useRef(false);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce.current) return;

    const viewTimer = setInterval(() => {
      if (!paused.current) setActive((i) => (i + 1) % VIEWS.length);
    }, ADVANCE_MS);
    const actTimer = setInterval(() => {
      if (!paused.current) setActivity((i) => (i + 1) % ACTIVITY.length);
    }, ACTIVITY_MS);
    return () => {
      clearInterval(viewTimer);
      clearInterval(actTimer);
    };
  }, []);

  const view = VIEWS[active]!;
  const ActiveNode = view.Node;
  const act = ACTIVITY[activity]!;

  return (
    <div
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <AppFrame
        label={view.url}
        ariaLabel="Live preview of the Munaxa platform, cycling through the owner dashboard, admissions, finance and reports"
        className="mx-auto w-full max-w-6xl"
      >
        <div className="relative">
          {/* Active view — re-keyed so each change plays a quiet crossfade. */}
          <div key={view.key} className="view-in min-h-[360px]">
            <ActiveNode />
          </div>

          {/* Live activity feed — believable, updating notifications. */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center sm:justify-start">
            <div
              className="flex max-w-full items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 shadow-xs backdrop-blur"
              aria-live="polite"
            >
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-cool opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-cool" />
              </span>
              <span
                key={activity}
                className={cn(
                  'view-in truncate text-[11px] font-medium',
                  act.tone === 'cool' && 'text-accent-cool',
                  act.tone === 'warm' && 'text-accent-warm',
                  act.tone === 'muted' && 'text-muted-foreground',
                )}
              >
                {act.text}
              </span>
            </div>
          </div>
        </div>
      </AppFrame>

      {/* View tabs — jump directly; quiet, not a carousel. */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
        {VIEWS.map((v, i) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setActive(i)}
            aria-current={i === active ? 'true' : undefined}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[0.8rem] font-medium transition-colors',
              i === active
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
