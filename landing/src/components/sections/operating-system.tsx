import { Reveal } from '@axa/platform';
import { SystemMap } from '@/components/product/system-map';

/**
 * The resolution: one core, every department wired to it. This is the thesis of the page — the
 * modules are not integrated apps, they are one operating system sharing a single record.
 */
export function OperatingSystem() {
  return (
    <section id="operating-system" className="relative overflow-hidden border-y border-border py-24 sm:py-32">
      <div className="dot-grid pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />

      <div className="shell grid items-center gap-14 lg:grid-cols-2 lg:gap-10">
        <Reveal className="order-2 lg:order-1">
          <SystemMap />
        </Reveal>

        <Reveal delay={80} className="order-1 lg:order-2">
          <p className="eyebrow">02 — The operating system</p>
          <h2 className="display mt-5 text-4xl sm:text-5xl lg:text-[3.4rem]">
            One record.
            <br />
            Every department.
          </h2>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Munaxa is the layer underneath the whole school. Admit a student and finance opens a fee
            plan. Mark attendance and the parent already knows. Nothing is re-entered, because there
            is only one place the data lives.
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 sm:max-w-md">
            {[
              { k: 'One student record', v: 'Shared across every module, in real time' },
              { k: 'Events, not exports', v: 'A change in one place updates everywhere' },
              { k: 'Role-aware', v: 'Owners, principals, teachers, parents' },
              { k: 'Built for scale', v: 'One campus to a national group' },
            ].map((item) => (
              <div key={item.k}>
                <dt className="font-display text-sm font-semibold">{item.k}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{item.v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
