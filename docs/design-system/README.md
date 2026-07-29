# Munaxa Brand Assets

**Purpose:** the Munaxa logo family and how each surface consumes it.
**Audience:** engineers wiring up a new app surface; designers producing brand artwork.
**Authority:** brand artwork only. This document is **not** the source of truth for colour,
tokens or components.

> **Where the design system actually lives.** Colour, tokens, typography, components and themes
> are owned by the shared platform:
>
> | Concern | Source of truth |
> | --- | --- |
> | Tokens (spacing, radius, elevation, motion, z-index, breakpoints) | [`platform/tokens/`](../../../platform/tokens) |
> | Typography scale | [`platform/typography/`](../../../platform/typography) |
> | Colour — the semantic contract | [`platform/themes/base/base.css`](../../../platform/themes/base/base.css) |
> | Colour — the Munaxa palette | [`platform/themes/school/palette.css`](../../../platform/themes/school/palette.css) |
> | Components and patterns | [`platform/ui/`](../../../platform/ui) |
> | How Munaxa consumes and enforces all of it | [`../ui-governance.md`](../ui-governance.md) |
>
> Earlier revisions of this file documented a violet palette and a `packages/config-tailwind`
> preset. Both were retired when the design system was extracted into the platform. The
> historical record is in [`../archive/`](../archive/README.md).

---

## Logo family

![Munaxa logo](./horizontal-lockup-light.png)

The Munaxa logo is the teal **M** mark with the **munaxa▪** wordmark, supplied as a family of
lockups. Each is keyed to transparent, with a light-theme and a dark-theme (white-text) variant.

| Variant | Files here | Use for |
| --- | --- | --- |
| **Horizontal lockup** | `horizontal-lockup-{light,dark}.png` | Headers, nav, dashboards, all portals, API docs |
| **Primary / stacked** | `primary-logo-{light,dark}.png`, `stacked-logo-{light,dark}.png` | Login, hero, splash, print (invoices, ID cards, letterhead) |
| **Wordmark** | `wordmark-{light,dark}.png` | Footers, email signature, legal pages |
| **Symbol (M mark)** | `symbol.png` (one asset, both themes) | Collapsed rail, loading and empty states, avatars, watermark |
| **App icon** | `app-icon.png` (teal tile) | Mobile / desktop / PWA launcher |
| **Favicon** | `favicon.png` (M mark) | Browser tab, small UI |

Apps show the matching theme variant automatically — a `dark:` CSS swap on web,
`Theme.brightness` on mobile. The symbol, app icon and favicon are single teal assets that read
correctly on both themes.

The canonical, full-resolution originals also live in the platform's per-product asset store,
[`platform/assets/school/`](../../../platform/assets/munaxa), which is the source for any new
surface. See [`platform/assets/README.md`](../../../platform/assets/README.md) for the naming
convention and brand usage rules.

## How apps consume the logo

- **Component:** `apps/admin/src/components/logo.tsx` and
  `munaxademo/src/components/logo.tsx` — `<Logo variant="horizontal|stacked|wordmark|symbol"
  size={…} />`. Landing uses `landing/src/components/site/wordmark.tsx`; mobile uses
  `munaxa_logo.dart`. **All scale by height.**
- **Vendored copies:** each app keeps downscaled PNGs in its own `public/`, served `unoptimized`
  — the Cloudflare/OpenNext image optimizer cannot process the full-resolution art.
- **Favicons and app icons** are generated from `favicon.png` (M mark → `favicon.ico`,
  `icon.png`) and `app-icon.png` (tile → `apple-icon.png`, mobile launcher) by
  [`scripts/gen-icons.py`](../../scripts/gen-icons.py).

## Brand rules

- Never recolour a lockup. When the full lockup does not fit, use the symbol in a single flat
  colour — brand, white or ink.
- Clear space is at least the height of the symbol on every side.
- On screen, never hardcode the brand hex. Use `bg-primary` / `text-primary`, which follow the
  active theme and both colour schemes. The literal hexes exist only for surfaces with no CSS —
  email, OG images, favicons, PDF — and are read from
  [`platform/themes/school/brand.ts`](../../../platform/themes/school/brand.ts).

## Related

- [`../ui-governance.md`](../ui-governance.md) — the binding rules for Munaxa UI
- [`../ux/README.md`](../ux/README.md) — Munaxa's UX architecture and pattern library
- [`platform/README.md`](../../../platform/README.md) — consuming the shared platform
