# Munaxa UI Governance

**Status:** Authoritative · **Canonical source of truth:** [`/platform`](../../platform/README.md)
**Applies to:** `apps/admin`, `landing`, `munaxademo` and all Munaxa UI.

The shared platform at the repository root is the **single, formal source of truth** for
tokens, themes, components and patterns. This document codifies how Munaxa consumes and enforces
it. The narrative design references under [`munaxadesignsystem/`](../munaxadesignsystem) remain
useful as pattern documentation, but they are **not** the source of any value — code is.

---

## 0. One brand, all surfaces

Every Munaxa surface renders the **Munaxa theme**, defined once in
[`/platform/themes/school/palette.css`](../../platform/themes/school/palette.css): teal
primary `#007595` with the `--accent-warm` / `--accent-cool` neutral accents and semantic
success / warning / info / destructive roles, in light and dark.

| Surface                | Theme comes from                                  |
| ---------------------- | ------------------------------------------------- |
| `apps/admin` (product) | `@import '@axa/platform/css/themes/munaxa';`  |
| `landing` (marketing)  | `@import '@axa/platform/css/themes/munaxa';`  |
| `munaxademo` (sandbox) | `@import '@axa/platform/css/themes/munaxa';`  |

**Rule:** there is exactly one physical palette file. No app inlines colours, forks a theme, or
maintains its own token copy. When the brand changes, edit the palette — every surface follows.

---

## 1. Source of truth & layering

| Layer                 | Home                               | Rule                                                                                       |
| --------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| **Tokens**            | `/platform/tokens`             | Spacing, radius, elevation, motion, z-index, breakpoints. Never invent a value.               |
| **Theme (colour)**    | `/platform/themes/munaxa`      | The only place a Munaxa colour is written down.                                              |
| **Primitives**        | `/platform/ui/components`         | The only home for Button, Input, Card, Dialog, Tabs, Table, … No app-local re-implementations. |
| **Patterns**          | `/platform/ui/patterns`           | StatCard, Stepper, Progress, Reveal, TokenReference.                                          |
| **Domain components** | `apps/admin/src/components/domain` | Munaxa-specific compositions over primitives (status badges, `RecordHeader`). Each owns the single source of truth for its domain's status colours. |

Deciding where something goes is covered in
[`/platform/README.md` §3](../../platform/README.md). The short version: one consumer means
it belongs to Munaxa; two consumers means it belongs to the platform.

---

## 2. Absolute rules (the "never" list)

- **Never** introduce a new colour, spacing, radius, shadow, z-index or motion value. Tokens only.
- **Never** hardcode hex/`rgb`/`hsl` colours or raw Tailwind palette classes (`bg-red-500`). Use
  semantic classes (`bg-primary`, `text-muted-foreground`, `bg-success`, `border-border`).
  _(Mechanically enforced — see §5.)_
- **Never** duplicate a primitive — reuse or extend the platform.
- **Never** put school, HR or finance terminology into the platform.
- **Never** change business logic, APIs, database schemas, routes or workflows for a design change.

## 3. Always

- **Theme:** light-first default; full dark mode via the `.dark` class and theme-aware tokens.
- **RTL:** logical properties (`ps-/pe-/ms-/me-/text-start/text-end/border-s/border-e/start-/end-`).
  Physical-direction utilities (`pl-/pr-/ml-/mr-/text-left/right`) are prohibited.
- **Accessibility (WCAG AA):** label every control (`Field`), `scope` on table headers, keyboard
  support + ARIA on interactive widgets, visible focus rings, `prefers-reduced-motion` respected,
  a skip link.
- **i18n:** all user-facing strings via `@school/i18n` (EN + AR); no hardcoded copy. The design
  system ships no copy — every string it renders arrives as a prop.
- **Permissions & tenancy:** respect `principal.permissions` (nav + actions) and tenant isolation;
  never surface data a role can't access.

## 4. Typography & theme baseline

- **Colour:** the Munaxa theme (§0). Radius base `0.5rem`, set per app in `globals.css`.
- **Fonts (one intentional per-surface difference):** `apps/admin` ships **self-hosted IBM Plex
  Sans** (Latin) + **IBM Plex Sans Arabic** (RTL) so the product app has no Google-Fonts/CDN
  dependency; the public surfaces (`landing`, `munaxademo`) use the display stack **Sora / Inter /
  Cairo**. Both expose the same `--font-display` / `--font-body` / `--font-arabic` variables, so
  components are font-agnostic.

## 5. Enforcement

- **ESLint guardrail** (`apps/admin/eslint.config.mjs`): blocks hardcoded hex colours and raw
  Tailwind palette colours in `src/**`. Build fails on violation. The platform carries the
  same rule for `ui/` and `tokens/`.
- **CI gates:** `pnpm validate` (theme contract + token mirrors), `pnpm lint`, `pnpm typecheck`,
  `pnpm test` and `pnpm build` must pass; `prettier` + `eslint --fix` run pre-commit.
- Each app's `globals.css` declares `@source` over `/platform/ui` so token classes used by
  shared components resolve.

## 6. Contribution flow

1. Check [`/platform`](../../platform/README.md) for an existing token / component / pattern, and
   read [`/platform/CONTRIBUTING.md`](../../platform/CONTRIBUTING.md) before changing anything there.
2. Reuse or extend it (preserving its public API) rather than forking.
3. If it is missing and **a second product would need it**, add it to the platform. If only
   Munaxa needs it, add it under `apps/admin/src/components` — never inline in a page.
4. Keep changes composition-only unless the task is explicitly about logic.
5. Verify: `pnpm turbo run typecheck lint --filter=@school/admin` and
   `pnpm turbo run build --filter=@school/admin`.

## 7. Exceptions (documented, not silent)

- **Modal scrims / nested-dialog z-index** may use values above the token scale (`z-[60/70/80]`)
  for stacking; documented inline. The demo's toast viewport is one such case and passes
  `viewportClassName="z-[60]"` rather than forking the component.
- **Print stylesheets and HTML email** inline theme values as literal hexes read from
  `themes.munaxa.brand` (a separate document can't read CSS variables).
- **Status badges** use a soft-tint variant of the semantic colours for dense tables (colours
  remain theme-sourced).

> When unsure, prefer the platform and ask before deviating.
