import bidiFactory from 'bidi-js';

/**
 * Bidirectional line layout for PDFKit.
 *
 * PDFKit (via fontkit) DOES run the embedded font's OpenType shaper — hand it Arabic in *logical*
 * order and the correct joined glyphs come out — but it performs **no** Unicode bidirectional
 * reordering, so a mixed Arabic/Latin/number string is laid out in the wrong visual order. This module
 * supplies exactly that missing piece: it splits a logical string into directional runs (UAX #9) and
 * returns them in **visual** order, each run still in logical order so the font can shape it. The
 * renderer then draws the runs left-to-right (each in the right font), letting the font shape Arabic
 * natively — no hand-written presentation-form table.
 *
 * Notes:
 *   - **NFC normalization** is applied first so decomposed sequences compose to their canonical form.
 *   - **Structured identifiers** with internal spaces (phone numbers, national IDs, grouped IBANs,
 *     reference numbers) are wrapped in an LRI…PDI isolate so the UBA keeps their groups left-to-right
 *     instead of reversing them; the isolate controls are stripped from the drawn runs.
 *   - Bidi is delegated to `bidi-js`, a faithful pure-JS UAX #9 implementation.
 */

// bidi-js is a faithful UAX #9 implementation; instantiate once (it is stateless per call).
const bidi = bidiFactory();

// Arabic-bearing Unicode ranges: Arabic block, Supplement, Extended-A, and Presentation Forms A/B.
// Written with \u escapes so no literal (and no stray U+FEFF) sits in the source.
const ARABIC_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** True when the string contains at least one Arabic-script character. */
export function containsArabic(text: string): boolean {
  return ARABIC_PATTERN.test(text);
}

// Unicode directional isolates (UAX #9): pin a run's internal direction without leaking to neighbours.
const LRI = '\u2066'; // LEFT-TO-RIGHT ISOLATE
const PDI = '\u2069'; // POP DIRECTIONAL ISOLATE
const BIDI_ISOLATES = /[\u2066-\u2069]/g;

// A run of two or more whitespace-separated ASCII "identifier" tokens (phone numbers, national IDs,
// IBANs, reference numbers) that contains a digit — kept left-to-right via an isolate. The '-' is last
// inside the class (literal); '/' needs no escape inside a character class.
const STRUCTURED_LTR_RUN = /[A-Za-z0-9+][A-Za-z0-9+/@._-]*(?:[ \u00a0][A-Za-z0-9+/@._-]+)+/g;

/**
 * Wrap structured LTR identifiers that contain internal spaces in an LRI…PDI isolate. In a right-to-left
 * paragraph the Unicode Bidi Algorithm would otherwise order their whitespace-separated groups
 * right-to-left (`+962 79 123 4567` → `4567 123 79 962+`); the isolate pins them left-to-right. We only
 * touch runs that contain a digit, so prose and single tokens (emails, URLs, single numbers) are left
 * alone. The isolate controls are removed from the drawn runs, so no formatting code point is rendered.
 */
function isolateStructuredIdentifiers(line: string): string {
  return line.replace(STRUCTURED_LTR_RUN, (run) => (/\d/.test(run) ? LRI + run + PDI : run));
}

/** One directional run, ready to draw: text in logical order (for the font to shape), plus direction. */
export interface VisualRun {
  /** Run text in logical order, with bidi isolate controls stripped. */
  text: string;
  /** True for a right-to-left (Arabic) run. */
  rtl: boolean;
}

/**
 * Split a logical string into directional runs returned in **visual** (left-to-right display) order.
 * Each run's `text` stays in logical order so the font's shaper produces the right joined glyphs; the
 * renderer draws the runs in array order. Pure Latin/numeric strings return a single LTR run unchanged
 * (fast path), so English documents are byte-for-byte identical to before.
 */
export function layoutRuns(input: string): VisualRun[] {
  const logical = input.normalize('NFC');
  if (!logical || !containsArabic(logical)) return [{ text: logical, rtl: false }];

  const isolated = isolateStructuredIdentifiers(logical);
  const embedding = bidi.getEmbeddingLevels(isolated);
  const { levels } = embedding;

  // Maximal same-level segments, in logical order.
  const runs: Array<{ start: number; end: number; level: number }> = [];
  for (let i = 0; i < isolated.length; ) {
    const level = levels[i]!;
    let j = i + 1;
    while (j < isolated.length && levels[j] === level) j += 1;
    runs.push({ start: i, end: j, level });
    i = j;
  }

  // Map each character to its run, then walk the visual character order and emit each run the first
  // time one of its characters appears — a same-level run's characters stay contiguous under UAX #9 L2,
  // so this yields the runs in visual order.
  const runOf = new Array<number>(isolated.length);
  runs.forEach((r, ri) => {
    for (let i = r.start; i < r.end; i += 1) runOf[i] = ri;
  });
  const visualIndices = bidi.getReorderedIndices(isolated, embedding);
  const order: number[] = [];
  const seen = new Set<number>();
  for (const logicalIndex of visualIndices) {
    const ri = runOf[logicalIndex]!;
    if (!seen.has(ri)) {
      seen.add(ri);
      order.push(ri);
    }
  }

  return order
    .map((ri) => ({
      text: isolated.slice(runs[ri]!.start, runs[ri]!.end).replace(BIDI_ISOLATES, ''),
      rtl: runs[ri]!.level % 2 === 1,
    }))
    .filter((run) => run.text.length > 0);
}

/** Base paragraph direction of a string per the bidi algorithm ('rtl' when it leads with Arabic). */
export function baseDirection(text: string): 'ltr' | 'rtl' {
  if (!containsArabic(text)) return 'ltr';
  const { paragraphs } = bidi.getEmbeddingLevels(text.normalize('NFC'));
  return paragraphs.length > 0 && paragraphs[0]!.level % 2 === 1 ? 'rtl' : 'ltr';
}
