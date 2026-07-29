import { Reveal } from '@axa/platform';
import { IntelligencePanel } from '@/components/product/intelligence-panel';
import { AppFrame } from '@/components/product/app-frame';

/**
 * School intelligence — because every module writes to one record, leadership gets a single,
 * honest view across the school without assembling a report from five systems.
 */
export function Intelligence() {
  return (
    <section id="intelligence" className="relative overflow-hidden py-24 sm:py-32">
      <div className="shell-wide">
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <Reveal>
            <p className="eyebrow">07 — School intelligence</p>
            <h2 className="display mt-4 text-4xl sm:text-5xl">
              Leadership sees
              <br />
              the whole school.
            </h2>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              When the data isn&apos;t scattered, insight isn&apos;t a project. Attendance,
              collection rate and academic performance read from the same source — live, at every
              level, across every campus.
            </p>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Owners get the group view. Principals get their campus. Everyone is looking at the same
              numbers.
            </p>
          </Reveal>

          <Reveal delay={100} className="relative">
            <div className="brand-glow absolute -inset-8 -z-10" aria-hidden />
            <AppFrame
              label="app.munaxa.com/reports"
              ariaLabel="The Munaxa intelligence dashboard: attendance trend, collection rate and performance by grade band"
            >
              <IntelligencePanel />
            </AppFrame>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
