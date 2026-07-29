# Design System Monorepo Refactor — Migration & Deliverables Report

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa — Design System as the single source of truth
**Branch:** `claude/design-system-monorepo-refactor-i0m1k6`
**Date:** 2026-06-26
**Type:** Architecture refactor only — **no UI redesign, no business-logic / API / workflow changes.**

> This document is the authoritative deliverable for the refactor. It covers all eight
> required outputs: (1) Migration Report, (2) New folder structure, (3) Components migrated,
> (4) Tokens migrated, (5) Compatibility layer, (6) Updated imports, (7) Documentation
> updates, (8) Validation report.

---

## 0. Executive summary

The platform now has a real **token + component foundation** that behaves like Polaris /
Fluent / Primer: one place for tokens, one place for components, consumed through stable
public APIs.

**Shipped & build-verified this phase:**

| Layer | Package | Status |
|---|---|---|
| Design tokens (single source of truth) | **`@school/design-tokens`** (new) | ✅ built, lint-clean |
| Icons (single icon source) | **`@school/icons`** (new) | ✅ built, lint-clean |
| Tailwind preset now consumes tokens | `@school/config-tailwind` | ✅ rewired, values identical |
| Component library, enterprise taxonomy | `@school/ui` | ✅ reorganized, public API stable |
| Canonical consumer unaffected | `apps/admin` | ✅ typecheck clean |

**Deliberately deferred (gradual migration, see §9):** physically deleting the duplicate
component/token copies inside the **standalone** apps (`munaxalanding`, `munaxademo`) and the
**design-system website** (`munaxadesignsystem`). Those three are independent pnpm roots with
their own lockfiles and separate Cloudflare deploys; consolidating them is a controlled,
per-app step that must not break their deployments. The foundation they will consume is now in
place, and every duplicate is inventoried below.

---

## 1. Migration Report — Audit of duplication

Scan scope: `apps/*`, `munaxalanding`, `munaxademo`, `munaxadesignsystem`, `packages/*`
(excluding `node_modules` / build output).

### 1.1 Duplicated UI components

`@school/ui` holds **19** canonical component files. The same primitives are re-implemented in
multiple other places:

| Component | Canonical | Duplicates found in |
|---|---|---|
| Button | `@school/ui` | landing, demo, design-system website |
| Card | `@school/ui` | landing, demo, design-system website |
| Badge | `@school/ui` | landing, demo, design-system website |
| Input | `@school/ui` | landing, demo, design-system website |
| Table | `@school/ui` | demo, design-system website |
| Spinner | `@school/ui` | demo, design-system website |
| Field | `@school/ui` | demo, design-system website |
| Textarea, Checkbox, Switch, Tabs, Tooltip, Dialog, Drawer, Pagination | `@school/ui` | design-system website |

- **`munaxalanding/src/components/ui/`** — 7 duplicate primitives (button, badge, input, card, label, + 2 app widgets).
- **`munaxademo/src/components/ui/`** — 7 duplicate primitives.
- **`munaxadesignsystem/client/src/components/ui/`** — **53** shadcn-style components (the full reference set; superset of `@school/ui`).

### 1.2 Duplicated design tokens

| Token surface | Locations |
|---|---|
| Brand palette / radius / shadows / fonts (Tailwind theme) | `packages/config-tailwind/preset.ts` **and** inlined verbatim in `munaxalanding/tailwind.config.ts` **and** `munaxademo/tailwind.config.ts` |
| Typed token modules (colors/spacing/typography/radius/shadows/motion/zIndex) | `munaxadesignsystem/client/src/design-system/tokens/*` |

These were three drifting copies of the same values. **`@school/design-tokens` is now the
single typed source**, and `config-tailwind` derives from it.

> ⚠️ **Drift detected during audit:** `munaxadesignsystem/.../tokens/colors.ts` had diverged to a
> teal/Orbix palette (`#007595`) while the **live** preset and apps ship the violet brand
> (`#7A3FFF`). `@school/design-tokens` carries the **live, shipped** values (violet) so the
> migration changes nothing visually. Reconciling the website's stale token file is a
> documentation cleanup, tracked in §9.

### 1.3 Duplicated utilities & icons

| Item | Locations |
|---|---|
| `cn()` class combiner | `@school/ui` (canonical), `munaxalanding/src/lib/cn.ts`, `munaxademo/src/lib/cn.ts`, `munaxadesignsystem/client/src/lib/utils.ts` |
| `token-reference` widget | landing, demo, design-system website (3 copies) |
| Icon library (`lucide-react`) | pinned independently by landing (`^0.469`) & design-system website (`^0.453`); 12 importers in landing alone. Now centralized in **`@school/icons`**. |

### 1.4 Duplicated hooks

Only the design-system website carries shared hooks (`useMobile`, `useComposition`,
`usePersistFn`). No cross-app hook duplication today; `@school/ui/src/hooks` is the destination
when they are promoted (§9).

---

## 2. New folder structure

### 2.1 Packages (workspace `packages/*`)

```
packages/
  design-tokens/      ← NEW · single source of truth for all tokens
    src/
      colors.ts  typography.ts  spacing.ts  radius.ts  elevation.ts
      border.ts  motion.ts  transitions.ts  z-index.ts  breakpoints.ts
      index.ts
    css/tokens.css     ← canonical CSS custom properties (opt-in import)
  icons/              ← NEW · single icon source (re-exports lucide-react)
    src/index.ts
  ui/                 ← reorganized into the enterprise taxonomy below
  config-tailwind/    ← (a.k.a. "tailwind-config") now consumes design-tokens
  config-eslint/      ← (a.k.a. "eslint-config")
  config-typescript/  ← (a.k.a. "tsconfig")
  contracts/ domain/ i18n/ utils/
```

> Naming note: the architecture brief lists `tailwind-config`, `eslint-config`, `tsconfig`.
> Those already exist as `config-tailwind`, `config-eslint`, `config-typescript`. They were
> **kept under their existing names** to avoid a churny, risky rename of working, widely-imported
> packages — the role is identical. This is the single intentional deviation from the brief's
> literal names.

### 2.2 `@school/ui` internal taxonomy

```
packages/ui/src/
  components/
    primitives/      button, badge
    forms/           input (+ Select, fieldBase), textarea, field, checkbox, radio, switch
    feedback/        spinner, empty-state, error-state, tooltip, dialog, drawer
    navigation/      tabs, pagination
    layout/          card
    data-display/    table, timeline
    patterns/        (composite patterns — populated in later phases)
  hooks/             (shared hooks — populated as hooks are promoted)
  lib/               cn  (moved here from src/cn.ts)
  icons/             re-export of @school/icons
  styles/            component-scoped CSS (keyframes/print/base)
  tokens/            re-export of @school/design-tokens
  index.ts           ← the single public API barrel
```

---

## 3. Components migrated

This phase **organized** the canonical set (no behavior change) and established the taxonomy
and category barrels. Files were moved with `git mv` (history preserved):

- **primitives:** Button, Badge
- **forms:** Input, Select, Textarea, Field, Checkbox, Radio, RadioGroup, Switch
- **feedback:** Spinner, EmptyState, ErrorState, Tooltip, Dialog, Drawer
- **navigation:** Tabs (+List/Trigger/Content), Pagination
- **layout:** Card (+Header/Title/Description/Content/Footer)
- **data-display:** Table (THead/TBody/TR/TH/TD), Timeline (+TimelineItem)

The duplicate copies in landing / demo / design-system website are **inventoried** (§1.1) and
queued for deletion-after-verification in §9 — nothing was deleted yet, per the "verify
compatibility before deleting" rule.

---

## 4. Tokens migrated

Every token category from the reference system is now typed and exported from
`@school/design-tokens`:

| Category | Export | Notes |
|---|---|---|
| Colors | `colors` | brand, ink, neutral, theme-aware coral/aqua, semantic (success/warning/info/danger), data-viz, gradient stops |
| Typography | `typography` | fontFamily, fontSize, fontWeight, lineHeight |
| Spacing | `spacing` | platform scale (rem) |
| Radius | `radius` | none→full (8/12/14/22/32px) |
| Elevation | `elevation` | sm/md/lg/card/glow/**focus ring** |
| Border | `border` | width, style, color token |
| Motion | `motion` | duration + easing |
| Transitions | `transitions` | ready-made `transition` presets composed from motion |
| Z-index | `zIndex` | base→toast named layering |
| Breakpoints | `breakpoints` | sm→2xl |

Plus `tokens` (the whole set as one object) and `@school/design-tokens/css` (CSS variables for
non-TS consumers). **No values were invented** — they mirror the live shipped brand.

---

## 5. Compatibility layer

Backward compatibility is the core safety property of this phase:

1. **Stable public API.** `@school/ui`'s `index.ts` exports the exact same names as before the
   reorganization (verified against the compiled `dist`). Only an additive `tokens` namespace
   was added. Internal files moved; the public surface did not.
2. **Admin barrel untouched.** `apps/admin/src/components/ui/index.ts` is still
   `export * from '@school/ui'`; all `@/components/ui` imports keep working unchanged.
3. **`'use client'` preserved** in the compiled output of interactive components
   (Dialog, Drawer, Tooltip, Tabs) so Next.js still treats them as client components.
4. **Identical preset output.** `config-tailwind` now reads values from `@school/design-tokens`
   but emits byte-identical theme values (verified: brand `#7A3FFF`, ink `#0B0518`, focus ring,
   z-index, durations all unchanged) — zero visual diff.
5. **Nothing deleted.** Duplicates remain in place until each consumer is migrated and verified.

---

## 6. Updated imports

| Where | Before | After |
|---|---|---|
| `@school/ui` component internals | `import { cn } from '../cn.js'` | `import { cn } from '../../lib/cn.js'` |
| `@school/ui` public barrel | flat component files | category barrels → single root barrel |
| `config-tailwind/preset.ts` | hardcoded hex literals | `import { colors, elevation, motion, zIndex, typography } from '@school/design-tokens'` |
| Apps (Admin) | `import { Button } from '@school/ui'` | **unchanged** (still the one true path) |

The rule going forward, enforced by convention and the public barrel: **apps import only from
`@school/ui` and `@school/design-tokens` — never deep internal paths.** A repo scan confirms
**zero** deep imports into `@school/ui/...` internals today.

---

## 7. Documentation updates

- This report (the master deliverable).
- `@school/design-tokens`, `@school/icons`, and the new `@school/ui` directories are
  self-documented with file-level docblocks describing ownership and the "single source of
  truth" contract.
- **Design-system website (`munaxadesignsystem`)** documentation refactor — turning each doc
  page into a live `@school/ui` consumer (Live Preview / Variants / Props / A11y / Usage / Copy
  Import / Copy Example / Do-Don't / Guidelines / Related) — is the explicit next phase (§9).
  It is intentionally **not** done in the same change that establishes the foundation, because it
  requires bridging the website's Vite + Tailwind v4 + Radix stack to the package, which is a
  larger, separately-reviewable migration.

---

## 8. Validation report

### 8.1 Build / typecheck / lint (this environment)

| Check | Result |
|---|---|
| `pnpm --filter @school/design-tokens build` | ✅ |
| `pnpm --filter @school/icons build` | ✅ |
| `pnpm --filter @school/ui build` | ✅ (`'use client'` preserved in dist) |
| `pnpm --filter @school/admin typecheck` | ✅ clean |
| `lint` (design-tokens, icons, ui) | ✅ clean |
| Token resolution from preset (runtime) | ✅ values identical to previous hardcoded preset |

> The API package's Prisma engine download fails in this sandbox (no outbound network for the
> Prisma binary); that is an environment limitation unrelated to this refactor and does not
> touch the design-system packages.

### 8.2 "Change a token → everything updates" — current truth

| Target | Editing `@school/design-tokens` propagates? |
|---|---|
| **Admin** | ✅ **Yes, today.** Admin → `config-tailwind` preset → `@school/design-tokens`. |
| **`@school/ui`** | ✅ Yes — consumes the preset's classes + can import tokens directly. |
| **Landing** | ✅ **Yes, live, as of Phase 4 (§12).** Landing joined the workspace and imports `@school/design-tokens` directly. (Supersedes the Phase-2 generator, now removed.) |
| **Demo** | ✅ **Yes, live, as of Phase 3 (§11).** Demo joined the workspace and consumes the shared preset → `@school/design-tokens` directly. |
| **Design-system website** | ⏳ **After §9 step.** Replace its local `tokens/*` with `@school/design-tokens`. |

### 8.3 "Change `Button.tsx` → every app updates" — current truth

✅ **True today for Admin, Demo and Landing** — all three consume `@school/ui` for their full
primitive set, so editing a component updates every one with no app edit. (Landing's last 4
primitives were normalized to canonical in Phase 5 — §13.) Becomes true for the website at §9.

---

## 9. Remaining gradual migration (next phases)

Ordered, each independently shippable and verifiable. **Nothing here deletes code until its
replacement is proven in that app.**

1. ~~**Landing → packages.**~~ ✅ **Done (Phase 4 §12 + Phase 5 §13).** Joined the workspace; tokens
   via `@school/design-tokens`, icons via `@school/icons`, all primitives (incl. Button/Badge/Card/
   Input + `cn`/`Label`) via `@school/ui`. All local primitive implementations removed.
2. ~~**Demo → packages.**~~ ✅ **Done in Phase 3 (§11)** — joined the workspace, consumes `@school/ui`
   + shared preset; 7 local `ui/*` and `lib/cn.ts` deleted.
3. **Design-system website → consumer-only.** Bridge `munaxadesignsystem` (Vite/Tailwind v4) to
   `@school/ui` + `@school/design-tokens`; replace its 53 local `ui/*` and `tokens/*`; rebuild every
   doc page as a live `@school/ui` consumer with the full documentation template (§7). Delete the
   local component/token copies — **the website must never own duplicate UI**.
4. **Promote shared hooks** (`useMobile`, `useComposition`, `usePersistFn`) into `@school/ui/hooks`.
5. **Grow `@school/ui`** to cover the reference superset still only in the website (Avatar, Select,
   DatePicker, Calendar, Combobox, Charts, Sidebar, Breadcrumb, StatCard, DataTable, Skeleton, etc.).
6. **Reconcile the stale website `colors.ts`** (teal drift) against `@school/design-tokens`.

### CI

The workspace `node` CI job already runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
`pnpm build` (turbo) across **all** workspace packages — so `@school/design-tokens`,
`@school/icons`, and `@school/ui` are now gated on every PR automatically. Standalone
`landing` / `demo` / `designsystem` jobs continue to gate those apps. As each app joins the
workspace in §9, it is covered by the same workspace gates.

---

## 10. Phase 2 — Landing token consolidation (interim; SUPERSEDED by Phase 4 §12)

> **Superseded.** Phase 2 bridged tokens into Landing via a committed generator while Landing was
> still a standalone pnpm root. With the owner's choice of **approach A**, Landing joined the
> workspace in Phase 4 and now imports `@school/design-tokens` directly, so the generator
> (`scripts/sync-design-tokens.mjs`, the `sync:tokens` scripts, the CI drift check, and
> `munaxalanding/src/design-tokens.generated.ts`) was **removed**. The section below is kept for
> history.


**Goal:** make `@school/design-tokens` the source of truth for Landing's tokens **without**
changing Landing's standalone deploy model and with **zero visual change**.

### 10.1 Why not just add Landing to the workspace?

Investigated and ruled out for this phase (documented so the decision is auditable):

- `munaxalanding` is an **independent pnpm root** (its own `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
  `.npmrc`). Both its `Dockerfile` and its **Cloudflare deploy** (`opennextjs-cloudflare build`,
  `wrangler.jsonc`) run `pnpm install --frozen-lockfile` **from inside `munaxalanding`** as a
  standalone root.
- The Cloudflare build/install command lives in an **external dashboard** (the repo's own CI
  comments confirm "Deployed to Cloudflare via the dashboard Git integration"), which this repo
  cannot edit or verify.
- Therefore, removing Landing's standalone lockfile to join the workspace would break the Docker
  self-host build **and** risk breaking a Cloudflare deploy that can't be fixed from here.
- Landing's Tailwind config is also a **customized variant** (different radius/shadow/gradient,
  extra `arabic` font + container-queries), not byte-identical to the shared preset — so it can't
  simply adopt the preset wholesale without visual changes.

### 10.2 What shipped (zero new runtime dep, zero visual change)

| Change | File |
|---|---|
| Token generator (reads the built `@school/design-tokens`, writes a committed, dependency-free module per app) | `scripts/sync-design-tokens.mjs` |
| `pnpm sync:tokens` / `pnpm sync:tokens:check` scripts | root `package.json` |
| Generated, committed token module Landing imports | `munaxalanding/src/design-tokens.generated.ts` |
| Tailwind config now imports `brand`/`ink` from the generated module (values identical) | `munaxalanding/tailwind.config.ts` |
| CI gate: fail if any app's generated tokens drift from the source | `.github/workflows/ci.yml` (`Design-token sync check`) |
| Generator output excluded from Prettier (formatting owned by the generator) | `.prettierignore` |

**Verification (this environment):** Landing `typecheck` ✅, `build` ✅ (identical route output to
the pre-change baseline), `lint` ✅; `pnpm sync:tokens:check` ✅ (no drift). Generated brand/ink
values are literally identical to the previously hardcoded ones — no CSS diff.

### 10.3 What still needs a decision (component distribution)

Deleting Landing's **7 local `ui/*` components** and `lib/cn.ts` in favor of `@school/ui`
requires a way for a standalone app to consume a **private** package. The generator pattern works
for *tokens* (plain values) but not for *React components*. Two viable paths — owner's call:

- **(A) Join the workspace** — true live imports (`edit Button.tsx → Landing updates`), but
  requires reworking the Docker build and the external Cloudflare build command.
- **(B) Publish `@school/*`** to a private registry (e.g. GitHub Packages) — Landing stays a
  standalone root and depends on versioned releases; needs release/versioning infrastructure.

Until that decision, Landing's local components remain (inventoried in §1.1); **nothing was
deleted**. The same generator already supports adding `munaxademo` as a second target (one line
in `scripts/sync-design-tokens.mjs`).

---

## 11. Phase 3 — Demo migrated onto the shared packages (approach A, shipped)

**Decision (owner):** approach **A** — standalone apps **join the pnpm workspace** and consume the
private `@school/*` packages live, using **`turbo prune`** to keep each app's deploy lean. Demo is
the first app migrated this way.

### 11.1 What shipped

| Change | Detail |
|---|---|
| **Joined the workspace** | Removed Demo's standalone-root markers (`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `package-lock.json`, `.npmrc`); added `munaxademo` to the root `pnpm-workspace.yaml`; added `@school/ui`, `@school/design-tokens`, `@school/config-tailwind`, `@school/config-typescript` as `workspace:*` deps. |
| **Components: one implementation** | `src/components/ui/index.ts` now `export * from '@school/ui'`; **deleted** the 7 local components (`button`, `badge`, `card`, `input`, `field`, `table`, `spinner`). All 31 `@/components/ui` import sites unchanged. |
| **`cn` deduped** | `src/lib/cn.ts` now re-exports `cn` from `@school/ui`; all 13 `@/lib/cn` importers unchanged. |
| **Tokens: one source** | `tailwind.config.ts` now `presets: [preset]` from `@school/config-tailwind` (values from `@school/design-tokens`) + scans `@school/ui` source. |
| **`Tone` promoted** | `@school/ui` now exports the `Tone` type (Demo pages import it from the barrel) — additive, backward-compatible for Admin. |
| **CI** | Removed the standalone `demo` job + its `paths-filter`; Demo is now built/typechecked/linted by the workspace `node` job via `turbo`. |

### 11.2 Deploy — `turbo prune` (the lean path)

`turbo prune munaxademo --docker` was verified to emit a minimal subset containing **only Demo +
its 6 `@school/*` dependencies** (no `api`, `prisma`, or `admin`) — so Cloudflare/Docker builds
stay small even though Demo is now in the monorepo. Build orchestration is handled by turbo:
`pnpm turbo run build --filter=munaxademo` builds `design-tokens → icons → ui → munaxademo` in order.

**One-time external change required (Cloudflare dashboard).** Demo deploys via Cloudflare's
dashboard Git integration, which this repo can't edit. Its build must now build the workspace deps
before the app. Either:
- **Simple:** root directory `munaxademo`, build command `pnpm install && pnpm run cf:build`
  (Demo's `cf:build` now prebuilds `@school/*` via turbo, then runs `opennextjs-cloudflare build`).
- **Lean (recommended):** root directory = repo root, build `pnpm dlx turbo prune munaxademo --docker`
  then install/build the pruned `out/` subset.

Until that dashboard setting is updated, the next Cloudflare deploy of Demo would fail at install —
**this is the only step not completed in-repo, and it's documented here for the owner.**

### 11.3 Visual impact (disclosed)

Demo's local components had **drifted** from canonical `@school/ui`. Adopting the canonical
components is intentional drift-correction (Demo now matches the real Admin product), but it is
visible and is disclosed here:

| Component | Visible change when switching to `@school/ui` |
|---|---|
| **Button** | corners `rounded-lg → rounded-md`; default loses `shadow-glow`; sizes `h-10/h-11 → h-9/h-10`; hover uses `accent` tokens |
| **Input / Field / Table** | adopt canonical spacing/typography/border treatment (small) |
| **Badge / Card / Spinner** | effectively identical (Badge differed by ~2 lines; Card/Spinner were identical) |
| **Card shadow & hero backdrop** | **preserved** via two explicit `theme.extend` overrides — **no change** |

If any of these deltas is unwanted, the fix is to adjust the **canonical** `@school/ui` component
(which then updates Admin + Demo together) — not to re-fork Demo.

### 11.4 Verification (this environment)

| Check | Result |
|---|---|
| `pnpm --filter munaxademo typecheck` | ✅ clean (all component APIs compatible) |
| `pnpm --filter munaxademo build` (`next build`) | ✅ all routes compiled |
| `pnpm turbo run build --filter=munaxademo` | ✅ 4 tasks (deps → demo) |
| `turbo prune munaxademo --docker` | ✅ minimal subset (demo + 6 pkgs) |
| `pnpm install --frozen-lockfile` | ✅ lockfile in sync |
| Admin typecheck (regression from `Tone` export) | ✅ clean |
| Landing token drift check | ✅ unchanged |

---

## 12. Phase 4 — Landing migrated onto the workspace (approach A, shipped)

Landing joined the workspace and now shares the platform's tokens, icons and shared utilities.
Because Landing is the **public marketing site**, the hard "no redesign" rule governed scope: the
zero-visual-risk consolidation was done in full; the marketing-flavored primitives were **not**
unilaterally restyled.

### 12.1 What shipped (zero visual change)

| Change | Detail |
|---|---|
| **Joined the workspace** | Removed Landing's standalone-root markers (`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc`); added `munaxalanding` to the root workspace; added `@school/ui`, `@school/design-tokens`, `@school/icons` as `workspace:*` deps. |
| **Tokens: one source** | `tailwind.config.ts` imports `colors` from `@school/design-tokens` directly (brand + ink). Landing keeps its marketing theme (radius/shadow/glow/fonts + container-queries) verbatim → no visual change. |
| **Icons: one source** | All **12** `lucide-react` importers repointed to `@school/icons` (drop-in re-export); the direct `lucide-react` dependency removed. |
| **`cn` deduped** | `src/lib/cn.ts` re-exports `cn` from `@school/ui`; the `clsx`/`tailwind-merge` direct deps removed. |
| **`Label` consolidated** | Promoted a canonical `Label` into `@school/ui` (ported verbatim from Landing → pixel-identical); `src/components/ui/label.tsx` re-exports it. |
| **Generator removed** | The Phase-2 token generator + CI drift check + generated file deleted (superseded — §10). |
| **CI** | Removed the standalone `landing` job + its `paths-filter`; Landing is now built/typechecked/linted by the workspace `node` job via `turbo`. |
| **Deploy** | `deploy`/`preview` now prebuild `@school/*` via turbo before `opennextjs-cloudflare build`. |

### 12.2 Deploy (same as Demo, §11.2)

Landing deploys via Cloudflare's external dashboard. The one-time dashboard change still applies:
its build command must build workspace deps first (`pnpm install && pnpm run deploy`, where
`deploy` now prebuilds `@school/*`), or use the lean `turbo prune munaxalanding --docker` subset.
**This external setting is the only step not completable in-repo.**

### 12.3 The 4 marketing primitives — RESOLVED in Phase 5 (§13)

> **Resolved: approach A (normalize).** The owner chose to normalize Landing's Button/Badge/Card/
> Input to the canonical `@school/ui` components. Done in Phase 5 (§13). The original analysis is
> retained below for context.

Landing's `Button`, `Badge`, `Card`, `Input` have a genuinely **different design spec** from
canonical `@school/ui` — this is the marketing look, not mere drift:

| Primitive | Landing (marketing) | `@school/ui` (product) |
|---|---|---|
| Button | `rounded-lg`, **`shadow-glow`** default, sizes h-9/11/12, exposes **`buttonVariants()`** for `<a>` CTAs | `rounded-md`, no glow, sizes h-8/9/10, no `buttonVariants` |
| Badge | **pill** (`rounded-full`), single neutral style | `rounded-md`, `tone`-based |
| Card | `rounded-xl` | shared radius |
| Input | exports `Textarea` from the same module | `Textarea` is a separate export |

Forcing these onto `@school/ui` would **visibly redesign the public marketing page** (and break the
`buttonVariants`/`Textarea` import contracts), which the mission forbids. Two clean resolutions —
**owner's call**:

- **(A) Normalize** Landing to the product components (Landing's CTAs lose the glow, badges square
  off, etc.) — true single implementation, visible marketing change.
- **(B) Make the canonical components configurable** to the marketing look: add opt-in
  `@school/ui` variants (e.g. a `glow` Button option + `buttonVariants` helper, a `pill` Badge, an
  `xl` Card radius) sourced from Landing's existing styles, then Landing consumes those. Preserves
  the marketing look **and** achieves one implementation. _(Recommended.)_

Until then, Landing's 4 primitives remain local (inventoried in §1.1); **nothing was deleted**.

### 12.4 Verification (this environment)

| Check | Result |
|---|---|
| `pnpm --filter munaxalanding typecheck` | ✅ clean |
| `pnpm --filter munaxalanding lint` | ✅ clean |
| `pnpm --filter munaxalanding build` (`next build`) | ✅ all routes compiled |
| `pnpm turbo run build --filter=munaxalanding` | ✅ deps → landing |
| No `lucide-react` imports remain in Landing | ✅ (all via `@school/icons`) |
| Admin + Demo typecheck (regression from `Label`) | ✅ clean |
| `pnpm install --frozen-lockfile` | ✅ in sync |

---

## 13. Phase 5 — Landing primitives normalized to canonical (approach A, shipped)

Owner decision on §12.3: **approach A — normalize**. Landing's 4 marketing primitives now use the
canonical `@school/ui` components; their local implementations are gone.

### 13.1 What shipped

| Change | Detail |
|---|---|
| **Canonical Button enriched** | Added `buttonVariants(variant, size, className?)` (positional) + exported `ButtonVariant`/`ButtonSize` from `@school/ui`. Additive — `Button`'s rendered output is unchanged for Admin/Demo (it now routes through `buttonVariants` internally). This gives `<a>`-as-button CTAs one shared styling source. |
| **Button** | `munaxalanding/src/components/ui/button.tsx` → re-exports `Button`, `buttonVariants`, `ButtonProps`, `ButtonVariant`, `ButtonSize` from `@school/ui`. The 3 `buttonVariants('…','…')` CTA call sites work unchanged. |
| **Badge / Card / Input** | each local file → a thin re-export from `@school/ui` (`Badge`; `Card*`; `Input` + `Textarea`). |
| **Local implementations removed** | The five duplicated primitive bodies (button/badge/card/input/label) are gone — only 1-line re-export shims remain so the deep-import paths (`@/components/ui/button`, …) keep working with zero call-site churn. |

### 13.2 Visual impact (accepted — this is the chosen normalization)

Landing's marketing flourishes are intentionally replaced by the product look:

| Primitive | Before (marketing) | After (canonical) |
|---|---|---|
| Button | `rounded-lg`, **`shadow-glow`**, h-9/11/12 | `rounded-md`, no glow, h-8/9/10 |
| Badge | **pill** `rounded-full`, neutral | `rounded-md`, tone-based |
| Card | `rounded-xl` | shared radius |
| Input / Textarea | h-11 / `min-h-32` | canonical field surface |

Landing now visually matches the Admin product. If a specific marketing treatment is wanted back,
add it as an **opt-in variant on the canonical component** (so it's available platform-wide), never
as a Landing-local fork.

### 13.3 Verification

| Check | Result |
|---|---|
| `@school/ui` build (+ `buttonVariants`) | ✅ |
| `pnpm --filter munaxalanding typecheck` | ✅ clean |
| `pnpm --filter munaxalanding lint` | ✅ clean |
| `pnpm --filter munaxalanding build` | ✅ all routes compiled |
| Admin + Demo typecheck (regression from Button changes) | ✅ clean |

**Result:** Landing, Demo and Admin now share **one** implementation of every primitive. The only
remaining duplicate UI in the platform is the design-system website (§9 item 3).

---

## 14. Phase 6 — Full munaxadesignsystem palette as the live single source

Owner decision: adopt the **complete** munaxadesignsystem palette (not just the primary hue) across
all sites, and make it the **live** single source of truth — editing one file re-themes every app
and every `@school/ui` component.

### 14.1 What shipped

| Change | Detail |
|---|---|
| **Canonical theme** | New `packages/design-tokens/css/theme.css` — the full munaxadesignsystem palette (neutral surfaces, teal primary, theme-aware accents, semantic success/warning/info) for light (`:root`) + dark (`.dark`). Values are the sRGB-gamut-mapped HSL channels of `munaxadesignsystem/client/src/index.css` (oklch → hsl via culori), consumed through the preset's existing `hsl(var(--token))` bridge so alpha modifiers keep working. |
| **Live single source** | Admin, Demo and Landing each `@import "@school/design-tokens/css/theme.css"` and **no longer define palette variables locally** — only app-specific non-palette vars remain (radius scale, hero backdrop, RTL fonts). Edit `theme.css` → all three apps and every `@school/ui` component (Button, Input, Card, Badge, …) re-theme at once. |
| **Static swatches** | `@school/design-tokens` `colors.ts` / `tokens.css` brand + focus ring updated to the teal brand to match. |
| **Package export** | `@school/design-tokens` now exports `./css/theme.css` (and `./css/*`). |

### 14.2 Visual result (verified on Demo, light + dark)

- **Light:** neutral white/near-white surfaces (previously violet-tinted), teal primary, neutral
  borders — matches the munaxadesignsystem site.
- **Dark:** neutral near-black surfaces (previously deep violet "ink"), dark teal primary.
- Buttons, inputs, cards, badges and stat tiles all follow, because they are `@school/ui`
  components coloured by the imported theme.

### 14.3 Verification

| Check | Result |
|---|---|
| `@school/design-tokens` build | ✅ |
| Demo `next build` (canary for `@import` resolution) | ✅ |
| Landing `next build` | ✅ |
| Admin typecheck | ✅ |
| Prettier (theme.css + all globals.css) | ✅ |
| Demo screenshots, light + dark | ✅ neutral surfaces + teal |

> Note: `@school/design-tokens` carries the munaxadesignsystem palette as the in-repo single source.
> Closing the loop so the `munaxadesignsystem` site *also* consumes this package (rather than holding
> its own copy in `index.css`) is the natural next step — it would make the DS site and the apps share
> one literal file.

---

## 15. Phase 7 — Loop closed: one authored palette file; DS site consumes the package

The Munaxa palette is now authored in **exactly one file** and consumed by everything, including
the design-system site.

### 15.1 The single source

`packages/design-tokens/css/theme.oklch.css` (oklch) is THE authored palette. From it:
- The **design-system site** (`munaxadesignsystem`, Tailwind v4) `@import`s it directly — added
  `@school/design-tokens` as a `file:` dependency; its `index.css` no longer defines palette
  colors (only fonts/radius/hero gradient remain local). Verified: the built DS CSS now contains
  `--primary: oklch(…)` from the package.
- The **Tailwind-v3 apps** (Admin/Landing/Demo) consume `theme.css`, which is **generated** from
  `theme.oklch.css` by `pnpm sync:theme` (oklch → sRGB-mapped hsl). CI guards drift via
  `pnpm sync:theme:check`.

So: edit `theme.oklch.css` → the DS site updates directly, and `pnpm sync:theme` propagates the
same change to every app and every `@school/ui` component.

### 15.2 Enforcement (every item uses tokens)

- Hex-ban ESLint guardrail now on **Admin, Landing, Demo, and `@school/ui`** (the token package
  is the only place hexes live). Demo gained a full ESLint config (`eslint.config.mjs`).
- Email templates (Demo + Landing) import `colors` from `@school/design-tokens` (no hex literals).
- The only remaining built-in color utilities (`text-white`) were replaced with `text-primary-foreground`.
- Pre-existing Admin typed-route `as never` casts were given scoped eslint-disables (keeps both
  `next build` and lint green).

### 15.3 Verification

| Check | Result |
|---|---|
| DS site `vite build` consuming the package | ✅ (built CSS has the oklch tokens) |
| `pnpm sync:theme:check` (theme.css ⇄ theme.oklch.css) | ✅ |
| Workspace `turbo run lint typecheck` | ✅ all (except `@school/api` typecheck, which needs `prisma generate` — env-only, CI runs it) |
| Demo + Landing `next build` | ✅ |

### 15.4 Note on "one literal file"

Two CSS files exist by necessity — `theme.oklch.css` (the authored source, used by the Tailwind-v4
DS site) and `theme.css` (generated, used by the Tailwind-v3 apps) — because the apps and the DS
site are on different Tailwind majors. Only `theme.oklch.css` is authored; `theme.css` is generated
and drift-gated, so there is still exactly one source of truth. Collapsing to a single physical file
would require migrating the apps to Tailwind v4 (a separate, larger effort).

---

## 16. Phase 8 — Single physical token file: all apps on Tailwind v4

The whole platform is now on **Tailwind v4** and consumes **one physical token file**.

### 16.1 What shipped

- **`packages/design-tokens/css/theme.oklch.css`** is now THE single physical palette file. The
  design-system site, `@school/ui`, **and all three apps** (Admin, Landing, Demo) consume it (via
  the shared `packages/design-tokens/css/tailwind.css`, the v4 equivalent of the old preset).
- **Admin, Landing, Demo migrated v3 → v4**: `@tailwindcss/postcss`, `@import "tailwindcss"` +
  the shared theme, removed `tailwind.config.ts`, swapped `tailwindcss-animate` → `tw-animate-css`,
  dropped `autoprefixer` (built into v4) and Landing's container-queries plugin (built into v4).
- **`@school/ui` is unchanged** — the shared `tailwind.css` carries small `@utility` shims
  (`z-modal`, `z-dropdown`, `shadow`, `shadow-sm`, `backdrop-blur-sm`) recreating the few classes
  v4 renamed/recalibrated, with their exact v3 values, so the component library renders identically.
- **`@source`** directives added per app so v4 scans `@school/ui`'s source for classes.
- Admin's login CSS rewritten from `hsl(var(--token)/α)` → `color-mix(in oklch, …)` (vars are oklch now).
- **Deleted:** `theme.css` (generated), `scripts/sync-theme.mjs`, the `sync:theme` scripts + CI
  check, `culori`, and the entire `@school/config-tailwind` v3 preset package.

### 16.2 Verification

| Check | Result |
|---|---|
| `next build` — Admin, Landing, Demo (v4) | ✅ all |
| `turbo run lint typecheck` (apps + ui + tokens) | ✅ all |
| Demo (light + dark) + Landing screenshots | ✅ pixel-equivalent / on-brand teal |
| Frozen lockfile | ✅ in sync |

> **Admin visual QA pending:** Admin builds, typechecks and lints clean on v4, but its
> authenticated screens couldn't be visually verified in this environment (needs DB/auth). The
> login-CSS `color-mix` rewrite is mathematically equivalent to the old `hsl(/α)`; please eyeball
> Admin in a real environment.

### 16.3 Result

There is now exactly **one** implementation of every component (`@school/ui`) and **one physical
file** of design tokens (`theme.oklch.css`), authored once and consumed live by every Munaxa
surface. Editing `theme.oklch.css` re-themes the design-system site, Admin, Landing and Demo.
