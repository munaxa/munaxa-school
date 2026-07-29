# Arabic rendering in the PDF pipeline

PDFKit (via **fontkit**) *does* run the embedded font's OpenType shaper — hand it Arabic in **logical**
order and the correctly joined glyphs come out — but it performs **no** Unicode bidirectional
reordering. So the renderer keeps text in logical Unicode and supplies only the missing bidi step,
letting the font shape natively. There is **no** hand-written presentation-form table.

## How text is drawn

`arabic-text.ts` exposes `layoutRuns(logical)` (plus `containsArabic` and `baseDirection`):

1. **NFC normalization** of the input.
2. **Structured-identifier isolation** – runs of two-or-more space-separated ASCII tokens containing a
   digit (phone numbers, national IDs, grouped IBANs, reference numbers) are wrapped in an
   `LRI…PDI` isolate (`U+2066…U+2069`, UAX #9 §2.4) so their groups stay left-to-right instead of
   reversing; the isolate controls are stripped from the returned runs.
3. **Bidi run splitting** – `bidi-js` (UAX #9) assigns embedding levels; the string is split into
   maximal same-level runs and returned in **visual** (left-to-right display) order, each run still in
   **logical** order so the font can shape it.

`PdfRenderer.drawText` then draws the runs as one `continued` sequence:

- Each run is drawn in its script's font — **`MunaxaArabic`/`MunaxaArabicBold`** for Arabic runs (with
  the `rtla` OpenType feature enabled) and **`MunaxaLatin`/`MunaxaLatinBold`** (Helvetica) for
  Latin/numeric runs. The font shapes Arabic natively (GSUB/GPOS), so joining, ligatures, mark
  positioning and spacing are the font's own — no presentation forms.
- **Right/center alignment** is applied manually for multi-run lines (measure the runs, compute the
  start x, draw left-to-right), because PDFKit's `align` is unreliable across `continued` fragments.
- The whole run sequence is wrapped in an **`/ActualText`** marked-content span carrying the original
  logical Unicode, so the text layer is correct even though the glyph stream is shaped/CID-encoded.

Pure Latin/numeric strings take a fast path (a single unchanged run), so English documents are
byte-for-byte identical to before. `DocumentLayout` and the renderer's public contract are unchanged.

## Logical text layer (copy / search / accessibility)

Because Arabic is shaped by the font, the raw glyph stream's reverse mapping (ToUnicode) is not a
reliable source of the original text. `drawText` therefore attaches the **original logical** Unicode as
an `/ActualText` marked-content entry (UTF-16BE). Conforming consumers — Adobe Acrobat, Chrome/Edge
(pdf.js), poppler `pdftotext`, PDF/UA screen readers — return that logical text on copy/search. Verified
by decoding the spans out of a rendered document (`أكاديمية مناكسة الدولية`, `أحمد محمد الخطيب`, …).
**Caveat:** extractors that ignore `/ActualText` (e.g. PyMuPDF's default `get_text`) return the shaped
glyph order — a limitation of those tools, not of the document.

## Fonts

The renderer registers four aliases: `MunaxaLatin` / `MunaxaLatinBold` (built-in Helvetica) and
`MunaxaArabic` / `MunaxaArabicBold` (an embedded Arabic TTF). The names are deliberately **not** the
built-in `Helvetica`: PDFKit pre-caches its default font under that exact name at construction, so
`registerFont('Helvetica', …)` is silently ignored and Arabic would fall back to the WinAnsi standard
font — emitting each 16-bit code unit as two Latin-1 bytes (`þ®…` mojibake). Our own names sidestep it.

The Arabic family resolves in priority order: `PDF_ARABIC_FONT_PATH` → the bundled
`fonts/NotoNaskhArabic-{Regular,Bold}.ttf` → Helvetica (last resort only if the bundle is missing). The
bundled pair is copied into `dist/documents/pdf/fonts/` by nest-cli's `assets` step, so `__dirname/fonts`
resolves in both tests (src) and production (dist) — an unconfigured deployment never silently loses
Arabic. **Noto Naskh Arabic** (OFL) is the default. Because shaping is now the font's job, **any**
OpenType Arabic font works — including GPOS-heavy faces like **Amiri** or Noto Sans Arabic — simply by
pointing `PDF_ARABIC_FONT_PATH` at it.

## Known limitations

### 1. Automatic width-wrapping of long mixed-direction paragraphs
Run order is computed per string. A single-direction paragraph (all Arabic *or* all Latin) wraps
correctly because the font/PDFKit handle it. A long paragraph that **mixes** directions **and** relies
on PDFKit's automatic width-wrapping can order runs incorrectly across a line break, because the visual
run order is computed for the whole string, not per wrapped line. Not affected: the overwhelming
majority of document text — single-line values (titles, headings, table cells, fields, meta,
signatures, footers) and single-direction paragraphs. Mitigation: insert explicit `\n` at intended
break points. Full fix: per-line bidi layout (take over line breaking from PDFKit).

### 2. Copy/paste depends on `/ActualText`
Correct copy/search/accessibility relies on `/ActualText`, honoured by Acrobat, Chrome/Edge, poppler
and PDF/UA readers. Extractors that ignore it see the shaped glyph order.

### 3. Paragraph alignment
The renderer keeps its existing left alignment for body paragraphs; RTL text is shaped and correctly
ordered but not right-aligned. Right-aligning RTL blocks is intentionally left out to preserve backward
compatibility (right/center alignment *is* handled for meta boxes, totals and table columns).
