'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  UserPlus,
  Users,
  CalendarCheck,
  GraduationCap,
  Wallet,
  Briefcase,
  Bus,
  MessageSquare,
  type Icon,
} from '@axa/platform/icons';
import { cn } from '@axa/platform';

/**
 * The connective diagram — one core with every department orbiting it, each wired back to the
 * center. Hovering (or focusing) a module reveals the departments it shares data with: the point
 * of the page is that these are not isolated apps but one record flowing through the OS.
 */

type Node = { label: string; icon: Icon; x: number; y: number; related: number[] };

// Eight departments on a ring around the core (percent coords). `related` = the modules each one
// exchanges data with — Communication is the notify layer, so it touches everything.
const NODES: Node[] = [
  { label: 'Admissions', icon: UserPlus, x: 50, y: 6, related: [1, 4, 7] },
  { label: 'Students', icon: Users, x: 81, y: 19, related: [0, 2, 3, 4, 6, 7] },
  { label: 'Attendance', icon: CalendarCheck, x: 94, y: 50, related: [1, 3, 7] },
  { label: 'Academics', icon: GraduationCap, x: 81, y: 81, related: [1, 2, 5, 7] },
  { label: 'Finance', icon: Wallet, x: 50, y: 94, related: [0, 1, 7] },
  { label: 'HR', icon: Briefcase, x: 19, y: 81, related: [1, 3] },
  { label: 'Transport', icon: Bus, x: 6, y: 50, related: [1, 7] },
  { label: 'Communication', icon: MessageSquare, x: 19, y: 19, related: [0, 1, 2, 3, 4, 5, 6] },
];

export function SystemMap() {
  const [hovered, setHovered] = useState<number | 'core' | null>(null);

  const activeSet =
    hovered === null
      ? null
      : hovered === 'core'
        ? new Set(NODES.map((_, i) => i))
        : new Set<number>([hovered, ...NODES[hovered]!.related]);

  const isActive = (i: number) => activeSet === null || activeSet.has(i);

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-xl"
      onMouseLeave={() => setHovered(null)}
    >
      {/* Connecting lines + soft core glow */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="url(#coreGlow)" />
        {NODES.map((n, i) => {
          const on = isActive(i);
          return (
            <line
              key={n.label}
              x1="50"
              y1="50"
              x2={n.x}
              y2={n.y}
              stroke="var(--primary)"
              strokeOpacity={activeSet === null ? 0.45 : on ? 0.9 : 0.12}
              strokeWidth={on && activeSet !== null ? 0.7 : 0.4}
              strokeDasharray="1.4 2.4"
              style={{ animation: 'dash-flow 1.6s linear infinite', transition: 'stroke-opacity 0.3s, stroke-width 0.3s' }}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {/* Core */}
      <button
        type="button"
        tabIndex={-1}
        onMouseEnter={() => setHovered('core')}
        onFocus={() => setHovered('core')}
        className="absolute left-1/2 top-1/2 z-10 flex h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-primary/30 bg-card text-center shadow-[0_20px_60px_-20px_var(--glow)] transition-transform duration-300"
        aria-label="Munaxa OS — the shared record every module reads and writes"
      >
        <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-xs ring-1 ring-border">
          <Image
            src="/logo-mark.png"
            alt="Munaxa"
            width={512}
            height={512}
            unoptimized
            className="h-full w-full object-contain"
          />
        </span>
        <span className="mt-1.5 px-1 font-display text-[0.7rem] font-semibold leading-tight">
          Munaxa OS
        </span>
      </button>

      {/* Nodes */}
      {NODES.map((n, i) => {
        const Icon = n.icon;
        const on = isActive(i);
        return (
          <button
            key={n.label}
            type="button"
            onMouseEnter={() => setHovered(i)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            aria-label={`${n.label} — shares data with ${n.related.map((r) => NODES[r]!.label).join(', ')}`}
            className={cn(
              'absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 outline-none transition-opacity duration-300',
              on ? 'opacity-100' : 'opacity-40',
            )}
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
          >
            <span
              className={cn(
                'grid h-11 w-11 place-items-center rounded-2xl border bg-card text-primary-strong transition-all duration-300',
                activeSet !== null && on
                  ? 'border-primary/60 shadow-[0_10px_30px_-12px_var(--glow)] scale-110'
                  : 'border-border shadow-[0_10px_30px_-16px_color-mix(in_oklch,var(--foreground)_50%,transparent)]',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span
              className={cn(
                'whitespace-nowrap text-[0.62rem] font-medium transition-colors',
                activeSet !== null && on ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {n.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
