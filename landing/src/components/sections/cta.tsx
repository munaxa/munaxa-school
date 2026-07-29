import { ArrowRight } from '@axa/platform/icons';
import { Reveal, buttonVariants, cn } from '@axa/platform';
import { DEMO_URL } from '@/lib/site';

/** Closing call to action — quiet confidence, one clear ask. */
export function CTA() {
  return (
    <section className="relative overflow-hidden py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="brand-glow absolute left-1/2 top-1/2 h-[540px] w-[900px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2" />
        <div className="line-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black,transparent)]" />
      </div>

      <Reveal className="shell text-center">
        <p className="eyebrow">Ready when you are</p>
        <h2 className="display mx-auto mt-5 max-w-3xl text-4xl sm:text-6xl">
          See your own school
          <br />
          running on Munaxa.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          We map Munaxa to your school — your grades, your fee structure, your campuses — and walk
          you through it live. A working demo, not a slideshow.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={DEMO_URL} className={cn(buttonVariants('default', 'lg', 'group'), 'w-full sm:w-auto')}>
            Book a demo
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
          </a>
          <a href="#contact" className={cn(buttonVariants('ghost', 'lg'), 'w-full sm:w-auto')}>
            Contact us
          </a>
        </div>
      </Reveal>
    </section>
  );
}
