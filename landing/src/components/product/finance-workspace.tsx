import { CheckCircle2, Clock } from '@axa/platform/icons';
import { cn } from '@axa/platform';

/**
 * Finance workspace — collections progress, a term summary, and a JoFotara e-invoicing status
 * strip. JoFotara is Munaxa's Jordan e-invoicing provider; invoices originate from charges and
 * are cleared through it.
 */

const INVOICES: { id: string; family: string; amount: string; status: 'cleared' | 'pending' }[] = [
  { id: 'INV-2026-0412', family: 'Al-Masri family', amount: 'JOD 1,850', status: 'cleared' },
  { id: 'INV-2026-0411', family: 'Haddad family', amount: 'JOD 1,420', status: 'cleared' },
  { id: 'INV-2026-0410', family: 'Khalil family', amount: 'JOD 1,180', status: 'pending' },
];

export function FinanceWorkspace() {
  return (
    <div className="@container bg-background p-4 text-foreground">
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-5">
        {/* Collections */}
        <div className="rounded-xl border border-border bg-card p-3 @2xl:col-span-2">
          <p className="text-[11px] text-muted-foreground">Term 1 collections</p>
          <p className="mt-1 font-display text-2xl font-bold mono">JOD 412,750</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-accent-cool" style={{ width: '91.5%' }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              <span className="mono text-accent-cool">91.5%</span> collected
            </span>
            <span className="text-muted-foreground">
              Outstanding <span className="mono text-accent-warm">JOD 38,400</span>
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { k: 'Invoiced', v: '451,150' },
              { k: 'Discounts', v: '12,300' },
              { k: 'Overdue', v: '9,240', tone: 'warm' as const },
            ].map((s) => (
              <div key={s.k} className="rounded-lg border border-border bg-background px-2 py-1.5">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{s.k}</p>
                <p className={cn('mono text-[11px] font-semibold', s.tone === 'warm' && 'text-accent-warm')}>
                  {s.v}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Invoices + JoFotara */}
        <div className="rounded-xl border border-border bg-card p-3 @2xl:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold">Recent invoices</p>
            <span className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-cool" aria-hidden />
              JoFotara e-invoicing · live
            </span>
          </div>
          <div className="space-y-1">
            {INVOICES.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 border-b border-border py-1.5 text-[11px] last:border-0"
              >
                <span className="mono w-28 shrink-0 text-muted-foreground">{inv.id}</span>
                <span className="min-w-0 flex-1 truncate">{inv.family}</span>
                <span className="mono font-medium">{inv.amount}</span>
                <span
                  className={cn(
                    'flex w-24 shrink-0 items-center justify-end gap-1 text-[10px]',
                    inv.status === 'cleared' ? 'text-accent-cool' : 'text-accent-warm',
                  )}
                >
                  {inv.status === 'cleared' ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" aria-hidden /> Cleared
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" aria-hidden /> Submitting
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
