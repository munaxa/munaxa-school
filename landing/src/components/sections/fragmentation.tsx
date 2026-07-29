import { Reveal, cn } from '@axa/platform';

/**
 * The problem, told typographically. Disconnected tools drift apart; the copy names the cost of
 * that fragmentation. Sets up the "one system" resolution in the next section.
 */

const TOOLS = [
  { label: 'Spreadsheets', x: 'left-[4%] top-[6%]', rotate: '-rotate-3' },
  { label: 'WhatsApp groups', x: 'left-[58%] top-0', rotate: 'rotate-2' },
  { label: 'Paper attendance', x: 'left-[26%] top-[30%]', rotate: 'rotate-1' },
  { label: 'A separate finance app', x: 'right-[3%] top-[26%]', rotate: '-rotate-2' },
  { label: 'PDF report cards', x: 'left-[2%] top-[62%]', rotate: 'rotate-2' },
  { label: 'A legacy SIS', x: 'left-[40%] top-[64%]', rotate: '-rotate-1' },
  { label: 'Email threads', x: 'right-[8%] top-[70%]', rotate: 'rotate-3' },
  { label: 'Printed bus lists', x: 'left-[70%] top-[42%]', rotate: '-rotate-2' },
];

export function Fragmentation() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="shell grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Reveal>
          <p className="eyebrow">01 — The problem</p>
          <h2 className="display mt-5 text-4xl sm:text-5xl">
            Most schools don&apos;t run on a system.
            <br />
            <span className="text-muted-foreground">They run on twelve.</span>
          </h2>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            Every department buys its own tool. None of them share a record. So the same student is
            typed in five times, the numbers never quite agree, and the person who should know first
            hears last.
          </p>
          <div className="mt-8 space-y-3">
            {[
              'Data re-entered across systems that never reconcile',
              'Finance, academics and the front office each holding a different truth',
              'Parents chasing updates the school already had',
            ].map((line) => (
              <div key={line} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="mt-2 h-1 w-4 shrink-0 rounded-full bg-accent-warm" aria-hidden />
                {line}
              </div>
            ))}
          </div>
        </Reveal>

        {/* Scattered, disconnected tools */}
        <Reveal delay={100} className="relative h-[360px] w-full sm:h-[420px]">
          <div className="dot-grid absolute inset-0 rounded-3xl border border-border/60 [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,black,transparent)]" />
          {TOOLS.map((t, i) => (
            <span
              key={t.label}
              className={cn(
                'absolute rounded-xl border border-border bg-card/80 px-3.5 py-2 text-sm text-muted-foreground shadow-xs backdrop-blur',
                t.x,
                t.rotate,
                i % 3 === 0 && 'opacity-90',
                i % 3 === 1 && 'opacity-70',
                i % 3 === 2 && 'opacity-80',
              )}
            >
              {t.label}
            </span>
          ))}
          {/* faint broken connectors */}
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            <line
              x1="20%"
              y1="30%"
              x2="60%"
              y2="55%"
              stroke="var(--hairline)"
              strokeWidth="1"
              strokeDasharray="3 6"
            />
            <line
              x1="70%"
              y1="20%"
              x2="45%"
              y2="70%"
              stroke="var(--hairline)"
              strokeWidth="1"
              strokeDasharray="3 6"
            />
          </svg>
        </Reveal>
      </div>
    </section>
  );
}
