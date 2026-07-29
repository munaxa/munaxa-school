'use client';

import { useEffect, useRef, useState } from 'react';
import { CountUp, cn } from '@axa/platform';

/**
 * School intelligence — a leadership view that reads across modules: attendance trend, collection
 * rate, and grade-level performance, all from the same operational data. Chart and stats animate
 * in the first time the panel is seen; static under prefers-reduced-motion.
 */

const TREND = [86, 88, 91, 89, 93, 95, 96];
const GRADES = [
  { g: 'KG', v: 72 },
  { g: 'G1–3', v: 84 },
  { g: 'G4–6', v: 88 },
  { g: 'G7–9', v: 82 },
  { g: 'G10–12', v: 90 },
];
const STATS = [
  { k: 'Attendance', v: 96.4, decimals: 1, suffix: '%', d: '+2.1', tone: 'cool' as const },
  { k: 'Collection rate', v: 91.5, decimals: 1, suffix: '%', d: '+4.3', tone: 'cool' as const },
  { k: 'Avg. GPA', v: 3.41, decimals: 2, suffix: '', d: '-0.04', tone: 'warm' as const },
];

export function IntelligencePanel() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [animated, setAnimated] = useState(false);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce.current) {
      setAnimated(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setAnimated(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const max = Math.max(...TREND);
  const min = Math.min(...TREND) - 3;
  const pts = TREND.map((v, i) => {
    const x = (i / (TREND.length - 1)) * 100;
    const y = 100 - ((v - min) / (max - min)) * 100;
    return `${x},${y}`;
  }).join(' ');

  const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';

  return (
    <div ref={ref} className="@container bg-background p-4 text-foreground">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-display text-sm font-semibold">School intelligence</p>
          <p className="text-[11px] text-muted-foreground">Live · across all modules</p>
        </div>
        <div className="flex gap-1.5">
          {['Term', 'Year'].map((t, i) => (
            <span
              key={t}
              className={cn(
                'rounded-md px-2 py-0.5 text-[10px]',
                i === 0 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 @xl:grid-cols-3">
        {STATS.map((s) => (
          <div key={s.k} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] text-muted-foreground">{s.k}</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="mono font-display text-xl font-bold">
                <CountUp value={s.v} decimals={s.decimals} suffix={s.suffix} />
              </span>
              <span className={cn('mono text-[11px]', s.tone === 'cool' ? 'text-accent-cool' : 'text-accent-warm')}>
                {s.d}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 @2xl:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-3 @2xl:col-span-3">
          <p className="mb-2 text-xs font-semibold">Attendance trend</p>
          <svg viewBox="0 0 100 44" preserveAspectRatio="none" className="h-24 w-full" aria-hidden>
            <polyline
              points={`0,44 ${pts} 100,44`}
              fill="var(--accent-cool)"
              opacity="0.08"
              stroke="none"
            />
            <polyline
              points={pts}
              fill="none"
              stroke="var(--accent-cool)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: animated ? 0 : 1,
                transition: reduce.current ? 'none' : `stroke-dashoffset 1.2s ${ease}`,
              }}
            />
          </svg>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 @2xl:col-span-2">
          <p className="mb-2 text-xs font-semibold">Performance by grade band</p>
          <div className="flex h-24 items-end gap-1.5">
            {GRADES.map((b, i) => (
              <div
                key={b.g}
                className="flex-1 rounded-t bg-primary/70"
                style={{
                  height: `${b.v}%`,
                  transform: animated ? 'scaleY(1)' : 'scaleY(0)',
                  transformOrigin: 'bottom',
                  transition: reduce.current ? 'none' : `transform 0.8s ${ease}`,
                  transitionDelay: reduce.current ? '0ms' : `${i * 80}ms`,
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex gap-1.5">
            {GRADES.map((b) => (
              <span key={b.g} className="flex-1 text-center text-[8px] text-muted-foreground">
                {b.g}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
