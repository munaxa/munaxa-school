/**
 * The minimized Munaxa mark: lowercase "m" followed by the square teal brand dot — the compact
 * counterpart to <Wordmark> and the app/tab icon. Used where the full logo is too detailed to
 * read (e.g. the collapsed sidebar rail). Size comes from the caller's font-size; the dot is
 * sized in `em` and RTL-aware via `ms-`.
 */
export function Monogram({ className = '' }: { className?: string }) {
  return (
    <span
      aria-label="munaxa"
      className={`inline-flex items-end font-display font-bold leading-none text-foreground ${className}`.trim()}
    >
      <span aria-hidden="true">m</span>
      <span
        aria-hidden="true"
        className="ms-[0.08em] mb-[0.06em] inline-block h-[0.32em] w-[0.32em] bg-primary"
      />
    </span>
  );
}
