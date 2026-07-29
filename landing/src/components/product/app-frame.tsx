import { Lock } from '@axa/platform/icons';
import { cn } from '@axa/platform';

/**
 * Browser/app window chrome that frames in-product UI so it reads as a real screenshot of the
 * Munaxa platform. Purely presentational — no data fetching.
 */
export function AppFrame({
  label,
  children,
  className,
  ariaLabel,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn('panel overflow-hidden', className)}
    >
      <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent-warm/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent-cool/60" />
        </div>
        <div className="mx-auto flex max-w-[62%] items-center gap-1.5 truncate rounded-md border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden />
          <span className="truncate mono">{label}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

/** A phone chrome for the parent / student mobile experiences. */
export function PhoneFrame({
  children,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn(
        'relative rounded-[2.25rem] border border-border bg-card p-2.5 shadow-[0_50px_90px_-40px_color-mix(in_oklch,var(--foreground)_45%,transparent)]',
        className,
      )}
    >
      <div className="absolute left-1/2 top-3 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-foreground/15" aria-hidden />
      <div className="overflow-hidden rounded-[1.85rem] border border-border bg-background">
        {children}
      </div>
    </div>
  );
}
