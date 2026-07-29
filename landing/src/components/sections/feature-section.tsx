import { ArrowRight } from '@axa/platform/icons';
import { Reveal, cn } from '@axa/platform';

/**
 * Editorial two-column module section: copy on one side, live product surface on the other.
 * `flip` mirrors the composition so consecutive sections never share the same rhythm.
 */
export function FeatureSection({
  id,
  index,
  kicker,
  title,
  lead,
  points,
  handoff,
  flip = false,
  children,
}: {
  id?: string;
  index: string;
  kicker: string;
  title: React.ReactNode;
  lead: string;
  points: { k: string; v: string }[];
  handoff?: string;
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="py-20 sm:py-28">
      <div className="shell grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal className={cn(flip && 'lg:order-2')}>
          <p className="eyebrow">
            {index} — {kicker}
          </p>
          <h2 className="display mt-4 text-3xl sm:text-4xl lg:text-[2.9rem]">{title}</h2>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">{lead}</p>

          <ul className="mt-7 space-y-4">
            {points.map((p) => (
              <li key={p.k} className="flex gap-3.5">
                <span className="mt-1 h-4 w-px shrink-0 bg-primary" aria-hidden />
                <span>
                  <span className="font-display text-sm font-semibold">{p.k}</span>
                  <span className="text-sm text-muted-foreground"> — {p.v}</span>
                </span>
              </li>
            ))}
          </ul>

          {handoff && (
            <p className="mt-7 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3.5 py-1.5 text-[0.78rem] text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5 text-primary-strong" aria-hidden />
              {handoff}
            </p>
          )}
        </Reveal>

        <Reveal delay={100} className={cn('relative', flip && 'lg:order-1')}>
          <div className="brand-glow absolute -inset-6 -z-10 opacity-70" aria-hidden />
          <div className="panel rise overflow-hidden">{children}</div>
        </Reveal>
      </div>
    </section>
  );
}
