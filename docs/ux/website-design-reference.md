# Munaxa Website — Design Reference

This package is the **canonical visual reference** for the Munaxa marketing
website (`munaxalanding`). Its foundations — colors, typography, radius,
elevation, themes, and RTL behavior — are aligned 1:1 with the brand the website
already ships.

> **Status:** reference / living style guide. This is **not** a published package
> the website imports at runtime. The website (`munaxalanding`) inlines the same
> tokens directly in its `tailwind.config.ts` and `globals.css`. When the brand
> changes, update both this reference and the website's inlined tokens.

## Where the tokens live

| Layer | This reference | Website (`munaxalanding`) |
|-------|----------------|---------------------------|
| Semantic CSS variables | `client/src/index.css` | `src/app/globals.css` |
| Typed tokens | `client/src/design-system/tokens/*` | inlined in `tailwind.config.ts` |
| Theme contract | `client/src/design-system/themes/index.ts` | CSS vars in `globals.css` |

## Brand foundations

### Color

- **Brand violet:** `#7A3FFF` (light tint `#B97BFF`). For legibility the semantic
  **primary** darkens on light surfaces (`#5B1FD6`) and brightens on dark (`#B97BFF`).
- **Theme-aware accents:** coral (`#D9534F` light / `#FF8E6E` dark) and
  aqua (`#0D9488` light / `#4DF4E1` dark). Exposed as `text-coral` / `bg-aqua` etc.
- **Surfaces:**
  - *Light (website default):* background `#F7F5FF`, card `#FFFFFF`, foreground `#1E0B4D`.
  - *Dark ("ink"):* background `#0B0518`, card `#1A0F38`, foreground `#F4F0FF`.
- **Semantic:** success = aqua, warning `#F59E0B`, danger = coral, info `#3B82F6`.

### Typography

- **Display / headings:** Sora
- **Body:** Inter
- **Arabic / RTL:** Cairo — in `dir="rtl"`, both display and body resolve to Cairo
  (Sora & Inter lack Arabic glyphs). Numbers/IDs/dates stay LTR via the `.mono` utility.

### Radius

Scale: `sm 8px` · `md 12px` · `lg/DEFAULT 14px` · `xl 22px` · `2xl 32px`.

### Elevation

- `card` — soft violet-tinted shadow + 1px inset border.
- `glow` — violet glow for primary surfaces.
- Focus ring: `0 0 0 3px rgb(122 63 255 / 0.28)` (global `:focus-visible`).

## Themes

Light is the **default** (conventional for a marketing site). The dark "ink"
theme is applied via the `.dark` class and kept at full parity. Both are defined
as CSS variables in `index.css` and typed in `themes/index.ts`.

## Using it as a reference

1. Run the showcase (`pnpm dev`) to browse foundations, primitives, patterns,
   accessibility, and RTL in the live website brand.
2. Treat the **token values** here as the source of truth; mirror any change into
   `munaxalanding`'s `tailwind.config.ts` + `globals.css`.
3. The school-admin components in `client/src/design-system/components/school`
   are demonstrations of the brand applied to product UI — they are not part of
   the marketing website and can be ignored when working on `munaxalanding`.

## What changed in this retarget

- Re-skinned all semantic CSS variables (`index.css`) from the previous neutral /
  IBM Plex admin palette to the Munaxa Design System website brand (violet + coral/aqua + ink).
- Swapped fonts to Sora / Inter / Cairo (loaded in `index.html`); RTL resolves to Cairo.
- Updated typed tokens (`colors`, `radius`, `typography`, `shadows`) and the theme
  contract to match.
- Updated foundation documentation pages (Tokens, RTL, Accessibility, Buttons,
  Components) to describe the website brand.
