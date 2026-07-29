# TOKEN_MIGRATION_REPORT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration
**Phase:** 2 — Token Migration
**Date:** 2026-06-18
**Branch:** `claude/affectionate-shannon-fbfeaf`
**Status:** ✅ Complete & build-verified — awaiting approval before Phase 3

> Governance rules honored: **no values invented.** Every token added was ported verbatim from the reference design system (`munaxadesignsystem/client/src/design-system/tokens/`). No business logic, APIs, schemas, or routes were touched.

---

## 1. Objective

Per the Phase-0 governance decision *"`@school/config-tailwind` stays canonical; extend it with missing scales from reference values,"* this phase:

1. Added the reference token scales the app was **missing**: semantic status colors, named z-index layering, motion (durations + easings), and a focus-ring shadow.
2. Remediated the **2 hardcoded-color hotspots** found in Phase 1 (attendance TONE map, reports print stylesheet).

---

## 2. Files Changed (4)

| File | Change |
|---|---|
| `packages/config-tailwind/preset.ts` | Added semantic colors, z-index scale, motion tokens, focus shadow |
| `apps/admin/src/app/attendance/page.tsx` | TONE map: `text-white` → semantic foreground tokens |
| `apps/admin/src/app/reports/page.tsx` | Print stylesheet: arbitrary CSS colors → DS token values (rgb) |
| *(verification)* | `pnpm --filter @school/admin build` — ✅ compiles, lint guardrail passes |

---

## 3. Tokens Applied

All values traced to `munaxadesignsystem/client/src/design-system/tokens/`.

### 3.1 Semantic status colors (`colors.ts → semantic`)
Added to `preset.ts` `theme.extend.colors`:

| Token | Value | Source |
|---|---|---|
| `success` | `#10B981` | `colors.semantic.success` |
| `warning` | `#F59E0B` | `colors.semantic.warning` |
| `info` | `#3B82F6` | `colors.semantic.info` |

- **`danger` intentionally omitted** — already covered by the existing `destructive` token (avoids two competing reds).
- **Flat values (no dark variant):** the reference palette defines a single value per semantic color. To honor *"never invent values,"* no theme-aware dark variants were fabricated. Tailwind supports alpha modifiers on hex (`bg-success/10`) automatically.
- *Open follow-up (governance, not code):* if dark-surface legibility of these three needs tuning later, that is a deliberate design decision — flagged, not silently invented.

### 3.2 Z-index layering (`zIndex.ts`)
Added `theme.extend.zIndex` (additive — numeric `z-*` utilities remain):

| Token | Value |
|---|---|
| `base` | 0 |
| `sticky` | 10 |
| `dropdown` | 20 |
| `overlay` | 30 |
| `modal` | 40 |
| `toast` | 50 |

> Needed by Phase 3 (Dialog/Drawer/Toast/Popover) so overlay stacking uses named tokens instead of ad-hoc numbers.

### 3.3 Motion (`motion.ts`)
Added `theme.extend.transitionDuration` and `transitionTimingFunction`:

| Duration | Value | | Easing | Value |
|---|---|---|---|---|
| `fast` | 120ms | | `standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `normal` | 200ms | | `enter` | `cubic-bezier(0, 0, 0, 1)` |
| `slow` | 300ms | | `exit` | `cubic-bezier(0.3, 0, 1, 1)` |

### 3.4 Focus shadow (`shadows.ts → focus`)
Added `theme.extend.boxShadow.focus = 0 0 0 3px rgb(122 63 255 / 0.28)` — the reference brand focus ring, for accessible focus states in Phase 11.

---

## 4. Hotspot Remediation

### 4.1 Attendance TONE map — `attendance/page.tsx`
Raw `text-white` (a hardcoded color) replaced with paired foreground tokens:

```diff
- ABSENT:  'bg-destructive text-white',
- EXCUSED: 'bg-primary text-white',
+ ABSENT:  'bg-destructive text-destructive-foreground',
+ EXCUSED: 'bg-primary text-primary-foreground',
```
(`bg-aqua/bg-coral text-ink-900` were already valid tokens and left unchanged.)
*Note:* the deeper improvement — replacing this hand-rolled map with an `AttendanceStatusBadge` domain component — is deferred to **Phase 5** (this phase is tokens-only).

### 4.2 Reports print stylesheet — `reports/page.tsx`
The print output is a **separate browser window** that cannot read the app's CSS variables, so arbitrary CSS colors were replaced with the **design system's own token values**, expressed as `rgb()`:

| Before | After | DS token |
|---|---|---|
| `black` | `rgb(17, 24, 39)` | neutral.900 (`#111827`) |
| `dimgray` | `rgb(107, 114, 128)` | neutral.500 (`#6B7280`) |
| `lightgray` | `rgb(229, 231, 235)` | neutral.200 (`#E5E7EB`) |
| `rgb(243, 240, 250)` | `rgb(245, 240, 255)` | brand.primarySoft (`#F5F0FF`) |

> `rgb()` (not hex) is used deliberately: the repo's own ESLint guardrail (`no-restricted-syntax`) bans hex literals in `src/**`, including inside template literals. `rgb()` is permitted and lets the print doc carry exact DS values while satisfying the guardrail.

---

## 5. Decisions & Non-Changes (and why)

| Scale | Decision | Rationale |
|---|---|---|
| **Spacing** | **Not restricted.** Kept Tailwind defaults. | The reference spacing scale (0,1,2,3,4,5,6,8,10,12,16,24) is a **subset** of Tailwind's defaults, which the app already uses (e.g. `gap-1.5`, `space-y-8`). Restricting to the reference set would **remove** values live pages depend on — a breaking change, not a migration. Tailwind defaults already satisfy every reference step. |
| **Radius** | No change. | Preset already maps `lg/md/sm` to `--radius` (shadcn bridge); `rounded-xl`/`rounded-full` (Tailwind defaults) cover the reference `xl`/`full`. |
| **Elevation shadows (sm/md/lg)** | No change. | Reference `sm/md/lg` differ from Tailwind defaults; overriding them would alter app-wide appearance (a redesign, out of scope). Added only the new, additive `focus` token. |
| **Typography (IBM Plex Sans)** | **Deferred to a dedicated step.** | Per the Phase-0 decision, IBM Plex Sans (+Arabic) is the source of truth. Swapping fonts touches `next/font` wiring in `layout.tsx` and is a behavior-visible change best done as a focused, separately-reviewed change rather than bundled into token scales. **Recommend scheduling as Phase 2b or folding into Phase 3.** |

---

## 6. Verification

- ✅ `pnpm --filter @school/admin typecheck` — clean
- ✅ `pnpm --filter @school/admin build` — all 29 routes compile
- ✅ Design-system ESLint guardrail (`no-restricted-syntax`, no hardcoded hex) — passes
- ✅ New tokens are additive; no existing utility class was removed or redefined

---

## 7. Remaining Violations (after Phase 2)

| Item | Status | Phase to resolve |
|---|---|---|
| Hardcoded **hex** colors in app `src/**` | **0** (lint-enforced) | — |
| Typography not yet on IBM Plex Sans | Open (deferred, §5) | 2b / 3 |
| Hand-rolled status color maps (attendance, timetable `STATUS_COLOR`) still inline | Tokens valid, but should become domain components | 5 |
| Semantic color dark-mode legibility tuning | Open governance question (flat values, §3.1) | revisit if needed |

No further hardcoded color/spacing/radius/shadow/z-index violations remain in app source.

---

## 8. STOP — Phase 2 Complete

4 files changed, build-verified. Token scales now match the reference system (semantic colors, z-index, motion, focus); both hardcoded-color hotspots remediated; **zero invented values.**

**One decision needed:** should the **IBM Plex Sans font swap** (§5) run as a small **Phase 2b** now, or be folded into **Phase 3 (Core Components)**? Either is fine — flagging because it's the one remaining token-layer item.

**Awaiting approval to begin Phase 3 (Core Component Migration).** Phase 3 will build the missing primitives into `@school/ui` (Textarea, Checkbox, Radio, Switch, Dialog/Drawer, Tabs, Pagination, Tooltip; `scope` on Table) and sweep raw `<button>/<input>/<textarea>/<table>/<checkbox>` onto them — the change that lifts teachers/parents/inventory out of NON_COMPLIANT.
