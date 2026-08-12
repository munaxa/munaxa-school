/**
 * The Munaxa wordmark as running text: the name always set lowercase, followed by the square
 * brand dot.
 *
 * Deliberately not an image, and deliberately not `ProductLogo`. This is for the places the
 * wordmark appears *inside a sentence* — a copyright line, a paragraph naming the company —
 * where a picture would break the line box, ignore the reader's font size and be announced as a
 * second copy of a word already in the text. Font size, weight and colour come from the caller;
 * the dot is sized in `em` so it scales with the surrounding text and picks up the product's
 * `--primary`.
 *
 * Anywhere the logo is the logo — headers, rails, sign-in, marketing — use `ProductLogo` from
 * `@munaxa/ui`, which renders the approved artwork.
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
