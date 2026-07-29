import { CalendarCheck, Wallet, Bus, GraduationCap } from '@axa/platform/icons';

/** Parent app — the "today" view a parent sees: their child, live status, fees, and updates. */
export function ParentApp() {
  return (
    <div className="bg-background px-4 pb-5 pt-8 text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-muted-foreground">Good morning, Rana</p>
          <p className="font-display text-base font-semibold">Adam · Grade 7-B</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/12 font-display text-sm font-semibold text-primary-strong">
          A
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-accent-cool" aria-hidden />
          <span className="text-[12px] font-medium">Present today</span>
          <span className="mono ms-auto text-[11px] text-muted-foreground">08:12</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {['M', 'T', 'W', 'T', 'F'].slice(0, 4).map((d, i) => (
            <div
              key={i}
              className="rounded-md bg-accent-cool/15 py-1 text-center text-[10px] font-medium text-accent-cool"
            >
              {d}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-border bg-card p-3">
          <GraduationCap className="h-4 w-4 text-primary-strong" aria-hidden />
          <p className="mt-2 text-[11px] text-muted-foreground">Term average</p>
          <p className="mono font-display text-lg font-bold">88%</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <Bus className="h-4 w-4 text-accent-warm" aria-hidden />
          <p className="mt-2 text-[11px] text-muted-foreground">Bus · Route 4</p>
          <p className="text-[12px] font-semibold text-accent-warm">~6 min away</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-foreground" aria-hidden />
          <span className="text-[12px] font-medium">Term 1 fees</span>
          <span className="mono ms-auto text-[11px] text-accent-warm">JOD 420 due</span>
        </div>
        <button className="mt-2.5 w-full rounded-lg bg-primary py-2 text-[12px] font-medium text-primary-foreground">
          Pay now
        </button>
      </div>

      <div className="mt-3 rounded-2xl bg-accent-cool/10 p-3">
        <p className="text-[11px] font-medium text-accent-cool">Report cards published</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">Munaxa Academy · 2h ago</p>
      </div>
    </div>
  );
}
