# TYPOGRAPHY_MIGRATION_REPORT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration
**Phase:** 2b — Typography Swap (IBM Plex Sans + Arabic)
**Date:** 2026-06-18
**Branch:** `claude/affectionate-shannon-fbfeaf`
**Status:** ✅ Complete & build-verified — awaiting approval before Phase 3

> Implements the Phase-0 governance decision: **IBM Plex Sans / IBM Plex Sans Arabic is the typographic source of truth** (`design-system/tokens/typography.ts`). No business logic, APIs, schemas, or routes touched.

---

## 1. What Changed

The app's fonts were **Sora (display) / Inter (body) / JetBrains Mono**. They are now the reference system's typography:

| Role | Before | After | Source |
|---|---|---|---|
| Display | Sora | **IBM Plex Sans** (variable, Latin) | `typography.fontFamily.sans` |
| Body | Inter | **IBM Plex Sans** (variable, Latin) | `typography.fontFamily.sans` |
| Arabic / RTL | *(none — Inter has weak Arabic)* | **IBM Plex Sans Arabic** (400/600/700) | `typography.fontFamily.sans` (2nd entry) |
| Mono | JetBrains Mono | **system mono stack** `ui-monospace, "SFMono-Regular", monospace` | `typography.fontFamily.mono` |

The headline win: **Arabic text now renders in a dedicated, brand-matched Arabic face** instead of falling back to a Latin font's poor Arabic coverage — directly improving RTL quality (Phase 12).

---

## 2. Files Changed (3 code + fonts)

| File | Change |
|---|---|
| `apps/admin/src/app/layout.tsx` | Replaced the 3 `localFont` declarations with IBM Plex Sans (display + body) and IBM Plex Sans Arabic; updated `<html>` class list |
| `packages/config-tailwind/preset.ts` | `fontFamily` stacks: appended `var(--font-arabic)` to display/body; added reference system mono fallback |
| `apps/admin/src/fonts/*` | **Added** `IBMPlexSans-latin.woff2`, `IBMPlexSansArabic-{400,600,700}.woff2`; **removed** `Sora-latin.woff2`, `Inter-latin.woff2`, `JetBrainsMono-latin.woff2` |

**No dependency changes** — `pnpm install --frozen-lockfile` passes with the original lockfile. Fonts are self-hosted woff2 (consistent with the prior approach); they were extracted from the open-source Fontsource packages (installed only transiently to obtain the files, then removed) since CDNs are blocked in this environment.

---

## 3. Key Implementation Decisions

1. **Combined Latin + Arabic into one logical family.** `--font-display`/`--font-body` = IBM Plex Sans (Latin); `--font-arabic` = IBM Plex Sans Arabic. The preset stacks list the Latin face first, then the Arabic face: since the Latin face has no Arabic glyphs, the browser automatically falls through to IBM Plex Sans Arabic for Arabic text. This faithfully reproduces the reference stack `"IBM Plex Sans", "IBM Plex Sans Arabic", system-ui, sans-serif`.
2. **No asset duplication.** `display` and `body` are two `localFont` instances pointing at the same woff2; Next content-hashes font files, so a **single asset is emitted** (verified: 4 media files = 1 shared Latin + 3 Arabic weights) and downloaded once.
3. **Backward-compatible preset, no var renames.** `munaxademo` also consumes this preset. Kept the existing CSS-var names (`--font-display`, `--font-body`, `--font-mono`) and only **appended** fallbacks. `munaxademo` is unaffected: its undefined `--font-arabic` is skipped, and `--font-mono` (which the admin app no longer defines) resolves to the new reference system mono stack.
4. **Mono → reference system stack.** The reference defines no custom mono font, so the JetBrains woff2 was dropped and mono now uses `ui-monospace, "SFMono-Regular", monospace`.
5. **Arabic weights 400/600/700** chosen to cover the UI's regular/semibold/bold usage; the variable Latin face covers `100–700`.

---

## 4. Verification

- ✅ `pnpm --filter @school/admin build` — compiles, all 36 static pages generated
- ✅ `pnpm install --frozen-lockfile` — clean (no dependency drift)
- ✅ Emitted font assets: exactly 4 woff2 (1 shared Latin + 3 Arabic), confirming dedup
- ✅ No references to the old fonts remain in `src/`
- ✅ Design-system ESLint guardrail still passes

---

## 5. Remaining Token-Layer Item

| Item | Status | Recommendation |
|---|---|---|
| **Light-first default theme** (Phase-0 decision #3) | **Not yet implemented** — `layout.tsx` still defaults `className="dark"` and `theme-locale-toggle` defaults to `'dark'`. | Small, isolated change (flip defaults in 2 spots). I kept it out of the font swap to honor the phase scope. **Propose doing it as a quick step before/with Phase 4**, since it's a visible default-state change worth reviewing on its own. |

---

## 6. STOP — Phase 2b Complete

Typography now matches the Munaxa Design System; Arabic rendering materially improved; build verified; zero dependency drift.

**Awaiting approval to begin Phase 3 (Core Component Migration)** — building the missing primitives (Textarea, Checkbox, Radio, Switch, Dialog/Drawer, Tabs, Pagination, Tooltip; `scope` on Table) into `@school/ui` and sweeping raw elements onto them.

Also: shall I fold the **light-first default** (§5) into the start of Phase 3, or keep it separate?
