# PATTERN_COMPLIANCE_REPORT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration
**Phase:** 4 — Pattern Compliance
**Date:** 2026-06-18
**Branch:** `claude/affectionate-shannon-fbfeaf`
**Status:** ✅ Mapping complete + composition primitives added & People module migrated (build-verified). Awaiting approval before Phase 5.

> Composition-only changes. **No business logic, APIs, schemas, routes, or workflows changed.**

---

## 1. Approach

Phase 4 maps each of the 29 routes to its Munaxa DS **pattern** and assesses *composition* compliance (page structure & state handling). To avoid duplicating later phases, gaps that belong to dedicated phases are **explicitly deferred**:

- **Record Workspace** structure → **Phase 6**
- **Global/entity Search & saved searches** → **Phase 7**
- **Audit trail / activity feed / approval flows** → **Phase 10**
- **Domain components** (StudentCard, InvoiceTable, …) → **Phase 5**

Phase 4's own scope is therefore: **pattern identification, page-composition structure, and the universal Empty / Loading / Error state patterns.**

---

## 2. Pattern Map (all 29 routes)

| Route | DS Pattern | Composition compliance | Notes / deferred gaps |
|---|---|---|---|
| `/` | **Dashboard** | 🟡 | KPIs + attendance breakdown + recent-activity + quick links present. Pattern says ≤4 KPIs + trend deltas + explicit “next action”; current has 6 KPIs, no deltas. Reshape needs trend data (product/API) → recommend, not forced. |
| `/people/students` | **CRUD** (→ Workspace P6) | 🟢 | search + table + states + detail dialog. EmptyState applied. Workspace tabs → P6. |
| `/people/teachers` | **CRUD** | 🟢 | Field-wired (P3), EmptyState applied. Add search/detail → P6/7. |
| `/people/parents` | **CRUD** | 🟢 | Field-wired (P3), EmptyState applied. |
| `/people/employees` | **CRUD** + KPIs | 🟢 | filters + KPIs + states + EmptyState. |
| `/people/cards` | **CRUD** | 🟢 | EmptyState applied; loading state thin (P11). |
| `/structure/schools` | **Settings/Hierarchy** | 🟡 | list + create; error rendered (see §4). Hierarchy tree → domain (P5). |
| `/structure/academic` | **CRUD/Hierarchy** | 🟡 | nested editors; cascading loads lack visible spinner (P11). |
| `/academics` | **CRUD** | 🟢 | states present; Textarea migrated. |
| `/attendance` | **Attendance** | 🟡 | fast marking + bulk present; keyboard shortcuts + AttendanceStatusBadge → P5/P11. |
| `/presence` | **Attendance/Log** | 🟢 | states complete. |
| `/timetable` | **Schedule grid** | 🟢 | bespoke matrix (intentional); scope added (P3). |
| `/finance` | **Finance** | 🟡 | statement/charges/payments/installments present. InvoiceTable/BalanceCard/AgingCard → P5; audit trail → P10. |
| `/finance/fee-plans` | **CRUD** | 🟢 | clean. |
| `/reports` | **Reports** | 🟡 | params → run → results → export present. Freshness indicator + ReportCard/FilterBar → P5. |
| `/communication` | **CRUD/Messaging** | 🟢 | Textarea migrated; scheduling/audit → later. |
| `/settings/users` | **Settings + CRUD** | 🟢 | Checkbox migrated; grouped config. |
| `/settings/roles` | **Settings + Permissions** | 🟢 | Checkbox migrated; permission catalog grouped. |
| `/settings/attendance` | **Settings** | 🟢 | grouped, auto-save, Spinner. |
| `/settings/integrations/jofotara` | **Settings/Wizard** | 🟢 | multi-step wizard; `aria-current` added (P3). |
| `/clinic` | **CRUD/Record** | 🟢 | Field-wired (P3); dual-panel. |
| `/fleet` | **CRUD** | 🟢 | multi-section; toggle a11y (P3). |
| `/inventory` | **CRUD** | 🟢 | Field-wired (P3) — was NON_COMPLIANT. |
| `/library` | **CRUD** | 🟢 | Field-wired (P3). |
| `/modules` | **Settings** | 🟢 | feature flags; `aria-pressed`. |
| `/platform/databases` | **Settings/Wizard** | 🟢 | toggle a11y (P3). |
| `/login` | **Auth form** | 🟢 | exemplary. |
| `/change-password` | **Auth form** | 🟢 | exemplary. |
| `/kitchen-sink` | **DS showcase** | 🟢 | reference. |

**Composition compliance distribution:** 🟢 22 · 🟡 7 · 🔴 0. The 🟡 pages are limited by gaps owned by Phases 5/6/7/10/11 — not by Phase-4 composition defects.

---

## 3. New Composition Primitives (added to `@school/ui`)

Two presentational pattern primitives — additive, token-styled, RTL/dark-ready:

| Component | Pattern | Notes |
|---|---|---|
| **EmptyState** | DS *Empty States* | Centered title + optional description + action + icon. Works inline **and inside a table cell** (`colSpan`). |
| **ErrorState** | DS *Error States* | Contained, non-alarming, `role="alert"`, optional recovery action + reference id; no stack traces. (Available for surface errors; inline form validation continues to use `Field`’s `error`.) |

(Loading state continues to use the existing `Spinner`.)

---

## 4. Composition Changes Made

- **People module migrated to `EmptyState`** (the designated *reference module*): students, teachers, parents, employees, cards — each in-table empty row now renders the standardized `EmptyState` instead of an ad-hoc muted `<td>`. Identical i18n keys reused; logic untouched.
- **Correction to the Phase-1 audit:** teachers, parents, and structure/schools were flagged as “errors caught but not surfaced.” On inspection they **already render their error state** (e.g. `teachers/page.tsx` L84, `parents` L77, `schools` L44). No fix was required; the audit note is hereby corrected. The new `ErrorState` is available should any page want the richer treatment.

**Verification:** `@school/ui` build · admin `typecheck` · admin `build` (36/36) — all green.

---

## 5. Roadmap — remaining composition work (not blocking)

| Item | Pages | Owner phase |
|---|---|---|
| Roll `EmptyState` out to remaining modules’ empty rows | finance, attendance, academics, fleet, inventory, library, clinic, communication, settings, structure | Phase 4 follow-through (mechanical) |
| Dashboard → Dashboard Pattern (≤4 KPIs + trend deltas + next action) | `/` | needs trend data — propose with product |
| Visible loading spinners where loads are silent | structure/academic (cascades), people/cards | Phase 11 (a11y) overlaps |
| Record Workspace structure (header→summary→tabs→timeline→related→audit) | students, teachers, parents, finance, employees | **Phase 6** |
| Global/entity search + saved searches | app-wide, people, finance, reports | **Phase 7** |
| Audit trail / activity feed / approvals | finance, students, attendance | **Phase 10** |

> The `EmptyState` rollout to remaining modules is deliberately deferred to keep this gate reviewable; the People module establishes the exact pattern to copy. Say the word and I’ll complete the rollout as a quick follow-up.

---

## 6. STOP — Phase 4 Complete

All 29 routes mapped; composition is sound (0 🔴); two state-pattern primitives added and the People reference module migrated; build green; logic/APIs/routes untouched.

**Awaiting approval to begin Phase 5 (Domain Component Migration)** — building StudentCard/StudentTable, InvoiceTable/BalanceCard/AgingCard/FeeStatusCard, AttendanceStatusBadge/AttendanceCard, ReportCard/ReportFilterBar, etc. into `@school/ui` and applying them, which directly closes most of the 🟡 pages above.

Optional: I can fold the **EmptyState rollout to the remaining modules** into the start of Phase 5 — let me know.
