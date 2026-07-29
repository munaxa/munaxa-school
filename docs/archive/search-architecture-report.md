# SEARCH_ARCHITECTURE_REPORT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration
**Phase:** 7 — Search Architecture
**Date:** 2026-06-18
**Branch:** `claude/affectionate-shannon-fbfeaf`
**Status:** ✅ Assessment + shared combobox a11y/keyboard upgrade (build-verified). Awaiting approval before Phase 8.

> No routes/APIs/logic changed.

---

## 1. Inventory of search surfaces

| Surface | Mechanism | State |
|---|---|---|
| **Global search** (cross-entity, command palette) | — | ❌ **absent** (no cmdk/spotlight; `advancedApi` in app-shell is feature-flags, not search) |
| **Student search** | list filter input (`people.searchPlaceholder`) | 🟢 present |
| **Staff search** | list filter (`query` state) | 🟢 present |
| **Entity selection search** (student/section/teacher/parent) | shared **`EntityPicker`** combobox (attendance, finance, academics, fleet, clinic, cards) | 🟢 present — **upgraded this phase** |
| **Invoice / report search** | parameter pickers + filters on finance/reports | 🟡 basic (no saved searches) |
| **Saved searches / recents** | — | ❌ absent |
| **Advanced filter panels** | per-page selects (section/date/status) | 🟡 inline, not a unified pattern |

**Summary:** entity-scoped search is solid (one shared combobox + per-list filters). The DS’s **global search, saved searches, and recents** are not implemented — these are **net-new features** (need API + product decisions), not design-compliance gaps, so they are documented as roadmap rather than forced.

---

## 2. Improvement made — `EntityPicker` is now a compliant combobox

`EntityPicker` is the app’s single reusable search control (used on ≥6 pages). It worked but lacked accessibility/keyboard support. Upgraded (API and behavior unchanged):

- **ARIA combobox semantics:** `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`; the list is `role="listbox"` with `role="option"` + `aria-selected` items.
- **Full keyboard navigation:** ↑/↓ move the active option, **Enter** selects, **Esc** closes; hover syncs the active index. (Previously mouse-only.)
- **`type="search"`** on the input.
- **Token fix:** dropdown `z-20` → **`z-dropdown`** token.
- **De-hardcoded copy:** “No matches.” is now an overridable `noMatchesLabel` prop (default preserved) for i18n.
- RTL: built from logical layout; arrow semantics are vertical (direction-agnostic).

This lifts **search keyboard-navigation + accessibility** compliance for every page that uses the picker, in one place.

---

## 3. Verification

- ✅ `pnpm --filter @school/admin typecheck` — clean
- ✅ `pnpm --filter @school/admin build` — 36/36 pages
- ✅ lint guardrail — passes
- EntityPicker API (`value`/`onChange`/`load`/`placeholder`) and fallback-to-ID behavior preserved.

---

## 4. Roadmap (net-new, needs product/API)

| Item | Notes |
|---|---|
| **Global command-palette search** | could use the `@school/ui` primitives; needs a cross-entity search API + permission-pre-filtering (search must never surface records the role can’t see) |
| **Saved searches / recents** | needs persistence (user prefs API) |
| **Unified advanced-filter pattern** | extract per-page section/date/status selects into a shared `FilterBar` domain component (pairs with Reports `ReportFilterBar`, Phase 5 wave) |
| **List-search empty/“no results” state** | apply `EmptyState` to filtered-to-zero list results (currently shows the generic empty row) |

> Per DS Search UX: any future global search must **pre-filter by permission/tenant** and never expose protected fields or counts — to be enforced when that feature is built (overlaps Phases 8–9).

---

## 5. STOP — Phase 7 Complete

Search surfaces inventoried; the shared search combobox is now keyboard- and screen-reader-accessible and tokenized; global/saved search documented as net-new roadmap. Build green.

**Awaiting approval to begin Phase 8 (Multi-Tenant UX)** — verifying tenant/school/campus/academic-year/role context, switchers, context indicators, cross-campus navigation, and data isolation.
