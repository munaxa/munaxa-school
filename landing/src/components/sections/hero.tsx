import { ArrowRight, ShieldCheck } from '@axa/platform/icons';
import { CountUp, Reveal, buttonVariants, cn } from '@axa/platform';
import { DEMO_URL } from '@/lib/site';
import { LiveShowcase } from '@/components/product/live-showcase';

const TRUST = [
  'Multi-tenant, single-record',
  'Arabic & English · RTL native',
  'JoFotara e-invoicing, built in',
];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-14 sm:pt-20">
      {/* Ambient brand glow + fine grid, kept subtle. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[540px]" aria-hidden>
        <div className="absolute inset-0 line-grid opacity-[0.5] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
        <div className="brand-glow absolute -top-24 left-1/2 h-[420px] w-[820px] max-w-[92vw] -translate-x-1/2" />
      </div>

      <div className="shell text-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[0.72rem] font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-cool" aria-hidden />
            The School Operating System · K-12
          </span>
        </Reveal>

        <Reveal delay={60}>
          <h1 className="display mx-auto mt-6 max-w-4xl text-[2.6rem] leading-[0.98] sm:text-6xl lg:text-[4.6rem]">
            Run the entire school
            <br className="hidden sm:block" /> as{' '}
            <span className="text-primary-strong">one system.</span>
          </h1>
        </Reveal>

        <Reveal delay={120}>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
            Admissions, academics, attendance, finance, transportation and communication — no longer
            separate tools. One platform, one record, updated the moment anything changes.
          </p>
        </Reveal>

        <Reveal delay={180}>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={DEMO_URL} className={cn(buttonVariants('default', 'lg', 'group'), 'w-full sm:w-auto')}>
              Book a demo
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </a>
            <a
              href="#operating-system"
              className={cn(buttonVariants('outline', 'lg'), 'w-full sm:w-auto')}
            >
              See how it connects
            </a>
          </div>
        </Reveal>

        <Reveal delay={240}>
          <ul className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm text-muted-foreground">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent-cool" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      {/* Hero product surface */}
      <Reveal delay={120} className="shell-wide mt-14 sm:mt-16">
        <div className="relative">
          <div
            className="brand-glow absolute -inset-x-10 -top-10 -bottom-16 -z-10"
            aria-hidden
          />
          <LiveShowcase />

          {/* Floating accent chips — depth, not decoration; numbers count up on view. */}
          <div className="float-soft absolute -left-2 top-16 hidden rounded-xl border border-border bg-card/90 px-3 py-2 shadow-lg backdrop-blur lg:block">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Collected</p>
            <p className="mono font-display text-sm font-bold text-accent-cool">
              <CountUp value={412750} prefix="JOD " />
            </p>
          </div>
          <div
            className="float-soft absolute -right-2 top-40 hidden rounded-xl border border-border bg-card/90 px-3 py-2 shadow-lg backdrop-blur lg:block"
            style={{ animationDelay: '1.4s' }}
          >
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Attendance</p>
            <p className="mono font-display text-sm font-bold text-primary-strong">
              <CountUp value={96.4} decimals={1} suffix="%" />
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
