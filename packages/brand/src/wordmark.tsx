/**
 * The Munaxa wordmark: the name always set lowercase, followed by the square teal brand dot.
 * Font size/weight/color come from the caller via `className`; the dot is sized in `em` so it
 * scales with the surrounding text and picks up the brand `--primary` teal.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`lowercase ${className}`.trim()}>
      munaxa
      <span
        aria-hidden="true"
        className="ms-[0.12em] inline-block h-[0.22em] w-[0.22em] bg-primary align-baseline"
      />
    </span>
  );
}
