import { Reveal } from '@axa/platform';
import { CommsComposer } from '@/components/product/comms-composer';
import { ParentApp } from '@/components/product/parent-app';
import { PhoneFrame } from '@/components/product/app-frame';

/**
 * Communication and parent engagement as two ends of one loop: the school publishes once, to an
 * audience resolved from real records, and families receive it in a purpose-built app.
 */
export function Engagement() {
  return (
    <section id="communication" className="py-20 sm:py-28">
      <div className="shell">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">06 — Communication &amp; parents</p>
          <h2 className="display mt-4 text-4xl sm:text-5xl">The parent loop, closed.</h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Publish once — in Arabic and English — to an audience the platform already knows.
            Families receive attendance, results and fees in one place, and the front office stops
            fielding the same call.
          </p>
        </Reveal>

        <div className="mt-14 grid items-center gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:gap-12">
          <Reveal className="relative">
            <div className="brand-glow absolute -inset-6 -z-10 opacity-70" aria-hidden />
            <div className="panel overflow-hidden">
              <CommsComposer />
            </div>
          </Reveal>

          <Reveal delay={120} className="mx-auto w-full max-w-[16rem]">
            <PhoneFrame
              ariaLabel="The Munaxa parent app showing a child's attendance, grades, bus status and fees"
              className="float-soft"
            >
              <ParentApp />
            </PhoneFrame>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
