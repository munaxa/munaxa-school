'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CalendarCheck,
  MessageSquare,
  GraduationCap,
  FileText,
  Wallet,
  Smartphone,
  type Icon,
} from '@axa/platform/icons';

/**
 * "A single day, connected" — one tap on the attendance register, traced as a single chain of
 * consequences through the platform. Rendered as a connected timeline whose rail draws itself in
 * and whose steps arrive in sequence, so the visitor reads it as one system reacting, not six
 * separate features. Fully visible and static under prefers-reduced-motion / no-JS.
 */

type Step = { time: string; module: string; icon: Icon; title: string; body: string };

const STEPS: Step[] = [
  {
    time: '08:12',
    module: 'Attendance',
    icon: CalendarCheck,
    title: 'A teacher marks attendance',
    body: 'One tap on the class register. The student record updates the instant it happens.',
  },
  {
    time: '08:12',
    module: 'Communication',
    icon: MessageSquare,
    title: 'The parent is notified',
    body: 'No one composes a message. Attendance itself sends the update — in seconds.',
  },
  {
    time: '13:40',
    module: 'Academics',
    icon: GraduationCap,
    title: 'A teacher enters grades',
    body: 'Term averages recalculate across the class the moment the marks are saved.',
  },
  {
    time: '13:40',
    module: 'Reports',
    icon: FileText,
    title: 'The report card updates',
    body: 'It reflects the new grade automatically — nothing exported, nothing re-typed.',
  },
  {
    time: '16:00',
    module: 'Finance',
    icon: Wallet,
    title: 'The finance balance updates',
    body: 'Fees, discounts and balances move with the same record, ready for JoFotara.',
  },
  {
    time: '16:01',
    module: 'Parent app',
    icon: Smartphone,
    title: 'The parent app reflects everything',
    body: 'Attendance, grades and balance — one record, in the family’s hand, already current.',
  },
];

export function ConnectedDay() {
  const ref = useRef<HTMLOListElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -20% 0px', threshold: 0.1 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <section className="relative overflow-hidden border-y border-border bg-secondary/30 py-24 sm:py-32">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="eyebrow">03 — How it feels</p>
          <h2 className="display mt-4 text-4xl sm:text-5xl">A single day, connected.</h2>
          <p className="mt-5 text-lg text-muted-foreground">
            One tap on the attendance register. Follow what happens next — a single chain of events,
            none of it typed twice.
          </p>
        </div>

        <ol ref={ref} className="relative mt-14 max-w-2xl">
          {/* Rail: a faint static track with a brand line that draws itself in on view. */}
          <div className="absolute bottom-6 left-[1.35rem] top-6 w-px bg-border" aria-hidden />
          <div
            className="draw-y absolute bottom-6 left-[1.35rem] top-6 w-px bg-primary/50"
            data-shown={shown ? 'true' : 'false'}
            aria-hidden
          />

          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li
                key={i}
                data-shown={shown ? 'true' : 'false'}
                style={{ transitionDelay: `${i * 110}ms` }}
                className="day-step relative flex gap-5 pb-9 last:pb-0"
              >
                <div className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-card text-primary-strong shadow-sm">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="pt-1">
                  <p className="mono text-[0.72rem] text-muted-foreground">
                    {s.time} · {s.module}
                  </p>
                  <p className="mt-1 font-display text-base font-semibold leading-snug">
                    {s.title}
                  </p>
                  <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{s.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
