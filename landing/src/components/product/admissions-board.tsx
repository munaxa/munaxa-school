import { cn } from '@axa/platform';

/**
 * Admissions pipeline — a stage-based board of applicants moving from inquiry to enrolled.
 * The "Enrolled" column hints at the hand-off into Finance (a fee plan is created on enrollment).
 */

type Card = { name: string; meta: string; tone?: 'cool' | 'warm' };

const COLUMNS: { title: string; count: number; cards: Card[]; accent: string }[] = [
  {
    title: 'Inquiry',
    count: 24,
    accent: 'bg-muted-foreground/40',
    cards: [
      { name: 'Yousef Haddad', meta: 'Grade 6 · Website' },
      { name: 'Mariam Odeh', meta: 'KG2 · Referral' },
    ],
  },
  {
    title: 'Assessment',
    count: 11,
    accent: 'bg-info',
    cards: [
      { name: 'Sami Barakat', meta: 'Grade 4 · Scheduled', tone: 'cool' },
      { name: 'Dana Suleiman', meta: 'Grade 9 · Interview' },
    ],
  },
  {
    title: 'Offer',
    count: 7,
    accent: 'bg-accent-warm',
    cards: [{ name: 'Layla Nasser', meta: 'Grade 1 · Sent', tone: 'warm' }],
  },
  {
    title: 'Enrolled',
    count: 38,
    accent: 'bg-accent-cool',
    cards: [{ name: 'Adam Zaid', meta: 'Grade 7 · Fee plan created', tone: 'cool' }],
  },
];

export function AdmissionsBoard() {
  return (
    <div className="@container bg-background p-4 text-foreground">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-display text-sm font-semibold">Admissions · 2025–2026</p>
          <p className="text-[11px] text-muted-foreground">80 active applications</p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
          Conversion <span className="mono text-accent-cool">47%</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 @2xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col.title} className="rounded-xl border border-border bg-card/60 p-2.5">
            <div className="mb-2 flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', col.accent)} aria-hidden />
              <span className="text-[11px] font-medium">{col.title}</span>
              <span className="ms-auto mono text-[10px] text-muted-foreground">{col.count}</span>
            </div>
            <div className="space-y-1.5">
              {col.cards.map((card) => (
                <div
                  key={card.name}
                  className="rounded-lg border border-border bg-background p-2"
                >
                  <p className="text-[11px] font-medium leading-tight">{card.name}</p>
                  <p
                    className={cn(
                      'mt-0.5 text-[10px]',
                      card.tone === 'cool' && 'text-accent-cool',
                      card.tone === 'warm' && 'text-accent-warm',
                      !card.tone && 'text-muted-foreground',
                    )}
                  >
                    {card.meta}
                  </p>
                </div>
              ))}
              <div className="rounded-lg border border-dashed border-border/70 py-1.5 text-center text-[10px] text-muted-foreground">
                + more
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
