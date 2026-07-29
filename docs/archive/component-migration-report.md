# COMPONENT_MIGRATION_REPORT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration
**Phase:** 3 — Core Component Migration
**Date:** 2026-06-18
**Branch:** `claude/affectionate-shannon-fbfeaf`
**Status:** ✅ Complete (core + carry-over sweep §6) & build-verified. Awaiting approval before Phase 4.

> Governance decisions honored (Phase 0/2b): components **ported into `@school/ui`**; **light-first** default; no business logic, APIs, schemas, or routes changed.

---

## 1. Headline

Two things were accomplished:

1. **Established `@school/ui` as the single canonical component layer** — it went from exporting only `cn()` to housing the full primitive set (7 existing primitives moved in + **9 new ones built**). The app consumes it through its existing `@/components/ui` barrel, so **no page import paths had to change**.
2. **Swept the highest-impact pages** onto the new primitives — most importantly, the **3 NON_COMPLIANT pages (teachers, parents, inventory) are fixed** via proper `Field`/label wiring.

Everything is **build-verified** (`typecheck` + `next build`, 36/36 pages) at each step.

---

## 2. The Canonical Component Layer (`@school/ui`)

### Moved in (behavior unchanged)
`Button`, `Card` (+Header/Title/Description/Content/Footer), `Badge`, `Input`, `Select`, `Field`, `Table`/`THead`/`TBody`/`TR`/`TH`/`TD`, `Spinner`.

### Built new (the Phase-1 X2 gap)
| Primitive | Notes |
|---|---|
| **Textarea** | Shares the Input/Select field surface (`fieldBase`) |
| **Checkbox** | Native, token-styled; optional associated `label` prop |
| **Radio** + **RadioGroup** | Native radio + `role="radiogroup"` wrapper |
| **Switch** | `role="switch"`, controlled, RTL-aware thumb transform |
| **Dialog** | Portal, `aria-modal`, labelled by title, Escape + backdrop close, scroll-lock, focus restore, `z-modal` |
| **Drawer** | Slide-over on a **logical** edge (`start`/`end`) so it mirrors under RTL; same a11y as Dialog |
| **Tabs** (+List/Trigger/Content) | Roving `tabindex`, **RTL-aware arrow-key** navigation, `aria-selected`/`aria-controls` |
| **Tooltip** | Hover + keyboard-focus, `role="tooltip"` + `aria-describedby` |
| **Pagination** | Accessible prev/next + page indicator, logical layout, i18n-able labels |

### Enhancements folded into existing primitives (additive, backward-compatible)
- **`Table` `TH`** now defaults `scope="col"` → fixes the systemic missing-`scope` a11y gap (X5) for every table at once.
- **`Field`** gained optional `error` (renders `role="alert"`) and `required` props.

### How it's wired (and why it's robust)
- Components live in `packages/ui/src/components/*`; exported via `packages/ui/src/index.ts`.
- Built with `tsc` to ESM `dist`; **verified that `'use client'` is preserved** at the top of compiled interactive components (Dialog/Drawer/Tabs/Tooltip), so Next treats them as client components.
- Tailwind already scans `packages/ui/src` (admin `tailwind.config.ts` content glob), so all token classes are emitted.
- Added `@types/react-dom` to `@school/ui` (for `createPortal`). No runtime deps added.
- App `@/components/ui/index.ts` is now just `export * from '@school/ui'`; the 2 deep `./ui/button` imports were repointed; app-local primitive files were deleted.

---

## 3. Light-First Default (governance decision #3)

- `layout.tsx`: removed the hardcoded `dark` class from `<html>`.
- `theme-locale-toggle.tsx`: default theme `dark` → `light` (state + persisted fallback).
- `globals.css`: comment updated. Dark mode remains fully supported via the toggle + `.dark` tokens.

---

## 4. Pages Swept (done)

| Page | Change | Effect |
|---|---|---|
| **people/teachers** | Every bare `Input`/`Select` in create form wrapped in `Field` (matching `htmlFor`/`id`); `dir`/`required`/handlers preserved | 🔴 NON → 🟡/🟢 |
| **people/parents** | Same Field wiring across the form | 🔴 NON → 🟡/🟢 |
| **inventory** | CreateItem + RecordTxn inputs wrapped in `Field` | 🔴 NON → 🟡/🟢 |
| **academics** | Raw `<textarea>` (CSV import) → `Textarea`; dropped redundant cn | raw control removed |
| **communication** | Announcement-body `<textarea>` → `Textarea` | raw control removed |
| **people/students** | CSV-import `<textarea>` → `Textarea` | raw control removed |
| **timetable** | `scope="col"` added to the schedule-grid headers | a11y |

**Note on timetable:** it is a bespoke schedule **matrix** (period × day), not a standard list table. Forcing the list-`Table` primitive would visually regress it and double-wrap inside its `Card`, so it intentionally keeps its custom grid and received the real a11y fix (`scope`). This is a deliberate, documented exception, not an oversight.

All swept pages: **logic, state, handlers, API calls, validation, and routes unchanged.** Verified by `typecheck` + `build`.

---

## 5. Verification

- ✅ `pnpm --filter @school/ui build` — clean; `'use client'` preserved in dist
- ✅ `pnpm --filter @school/admin typecheck` — clean
- ✅ `pnpm --filter @school/admin build` — 36/36 pages
- ✅ Design-system ESLint guardrail — passes

---

## 6. Carry-over Sweep — ✅ COMPLETED (Phase 3b)

The mechanical sweep that the interrupted agents left was finished in a follow-up pass (build-verified):

| Item | Pages | Status |
|---|---|---|
| Raw `<input type=checkbox>` → `Checkbox` | settings/users, settings/roles, structure/academic, people/students (vaccine) | ✅ done (rich label wrappers preserved) |
| Bare form inputs → `Field` wrapping | clinic (visit + medical-record forms), library (create + checkout forms) | ✅ done (id/htmlFor wired, i18n keys verified) |
| `aria-current="step"` on stepper; `aria-expanded` on toggle; missing `type="button"` | jofotara wizard, platform/databases toggle, structure/schools name | ✅ done |
| Audit-flagged raw `<button>`s reviewed | settings/roles (select-all + row), people/employees (name cells), structure/academic (delete), finance (household) | ✅ verified already accessible (visible text label + `type`/`aria-label`) — **intentionally left as native buttons**, not restyled into `Button`, to avoid UX regressions |
| Surface caught-but-hidden errors | teachers, parents, structure/schools | ↪ deferred to **Phase 4** (state/error-handling work) |

> people/employees had no remaining raw checkbox. Custom controls (attendance status pills, jofotara stepper, expandable-row toggles) were given accessible names/state but **not** restyled into `Button` by design.

---

## 7. STOP — Phase 3 Core Complete

The canonical component layer exists in `@school/ui` with the full primitive set; the NON_COMPLIANT pages are fixed; light-first is in; build is green.

**Two paths for your call:**
- **(A)** Finish the §6 carry-over sweep now (a short Phase 3b), then proceed to Phase 4; or
- **(B)** Proceed to **Phase 4 (Pattern Compliance)** and fold the §6 items into it (several overlap with Phase 4's state/error-handling work).

**Awaiting approval** — and your preference between (A) and (B).
