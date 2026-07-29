import { Send, Check, CheckCheck } from '@axa/platform/icons';
import { cn } from '@axa/platform';

/**
 * Communication — an announcement composer with live audience targeting and per-channel delivery.
 * The audience is resolved from the same student/parent records the rest of the platform uses.
 */

const AUDIENCE = ['Grade 7', 'Grade 8', 'Grade 9'];
const DELIVERY: { channel: string; sent: string; state: 'delivered' | 'read' }[] = [
  { channel: 'Push', sent: '412', state: 'read' },
  { channel: 'Email', sent: '412', state: 'delivered' },
  { channel: 'SMS', sent: '96', state: 'delivered' },
];

export function CommsComposer() {
  return (
    <div className="@container bg-background p-4 text-foreground">
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-3 @2xl:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold">New announcement</p>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
              Draft
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground">To</p>
          <div className="mb-2 mt-1 flex flex-wrap gap-1.5">
            {AUDIENCE.map((a) => (
              <span
                key={a}
                className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary-strong"
              >
                {a}
              </span>
            ))}
            <span className="mono text-[10px] text-muted-foreground">= 412 parents</span>
          </div>

          <div className="rounded-lg border border-border bg-background p-2.5">
            <p className="text-[11px] font-medium">Term 1 report cards are published</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Report cards for Grades 7–9 are now available in the parent portal. Please review and
              acknowledge before the parent-teacher conference on Sunday.
            </p>
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {['EN', 'AR'].map((l) => (
                <span
                  key={l}
                  className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {l}
                </span>
              ))}
            </div>
            <span className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
              <Send className="h-3 w-3" aria-hidden /> Publish
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 @2xl:col-span-2">
          <p className="mb-2 text-xs font-semibold">Delivery</p>
          <div className="space-y-2">
            {DELIVERY.map((d) => (
              <div key={d.channel} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{d.channel}</span>
                <span className="flex items-center gap-1.5">
                  <span className="mono">{d.sent}</span>
                  <span
                    className={cn(
                      'flex items-center gap-0.5',
                      d.state === 'read' ? 'text-accent-cool' : 'text-muted-foreground',
                    )}
                  >
                    {d.state === 'read' ? (
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-accent-cool/10 px-2.5 py-2 text-[11px] text-accent-cool">
            <span className="mono font-semibold">88%</span> opened within 2 hours
          </div>
        </div>
      </div>
    </div>
  );
}
