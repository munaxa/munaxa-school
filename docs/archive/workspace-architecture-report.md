# WORKSPACE_ARCHITECTURE_REPORT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration
**Phase:** 6 — Workspace Architecture
**Date:** 2026-06-18
**Branch:** `claude/affectionate-shannon-fbfeaf`
**Status:** ✅ Assessment + Student exemplar complete (build-verified). Awaiting approval before Phase 7.

> Composition-only. **No routes, APIs, schemas, or workflows changed** — record detail views remain modal-based (no new routes were added, per the agreed scope).

---

## 1. Record Workspace pattern (DS reference)

A compliant record workspace composes, in order:
**Header** (identity + status + key metadata + actions) → **Summary** (≤ a few at-a-glance metrics) → **Actions** → **Tabs** (stable domains) → **Timeline** (activity) → **Related Records** → **Audit Trail**.

---

## 2. Assessment — current record views

| Record | Where | Header | Summary | Actions | Tabs | Timeline | Related | Audit | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| **Student** | `student-profile-dialog.tsx` | ✅ identity+status | ➕ finance totals (in tab) | ✅ edit/close | ✅ **(this phase)** | ❌ | ✅ parents/guardians | ❌ | 🟢 **exemplar built** |
| **Teacher** | `teacher-profile-dialog.tsx` | ✅ | ⚠️ | ✅ | ❌ stacked | ❌ | ⚠️ | ❌ | 🟡 needs tabs |
| **Parent** | `parent-edit-dialog.tsx` | ⚠️ (edit form) | ❌ | ✅ | ❌ | ❌ | ⚠️ children | ❌ | 🟡 |
| **Employee** | `employee-profile-dialog.tsx` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 🟡 |
| **Finance (student acct)** | finance page + student finance tab | ✅ | ✅ totals | ✅ charge/pay | ⚠️ sections | ❌ | ⚠️ installments | ❌ (statement only) | 🟡 |

**Common gaps (all records):** no **activity Timeline**, no **Audit Trail** surface. These require activity/audit **data** (API) that isn't currently exposed to the client → they are correctly the domain of **Phase 10 (Audit & Compliance)**, not composition. Flagged, not faked.

---

## 3. Student Workspace — Exemplar Implemented

`student-profile-dialog.tsx` was refactored (composition only; all data loading, edit, vaccine, parent-link, and finance logic preserved) to the workspace pattern:

- **Header** retained: avatar/initials, EN + AR name, status Badge, section Badge, Edit + Close actions.
- **Tabs** introduced (using the new `@school/ui` `Tabs`, with roving-tabindex + RTL arrow-key nav):
  - **Overview** — identity details (national id, MOE #, QR, status, section, enrolled).
  - **Relationships** — guardians/parents (related records) with add/edit.
  - **Health** — government vaccines.
  - **Finance** — full statement: totals summary + charge balances + transactions.
- **Domain components applied** in the Finance tab: `ChargeStatusBadge` + `TransactionStatusBadge` (removed yet another local `CHARGE_TONE` duplicate + inline tone ternary).
- **Tokenized the modal surface**: `z-[60]` → `z-modal`, `bg-black/50` → `bg-foreground/40` (removed hardcoded z-index/color).

Result: the long vertical scroll is now an organized, keyboard-navigable, RTL-correct tabbed workspace — the reference for rolling out to the other records.

---

## 4. Verification

- ✅ `pnpm --filter @school/admin typecheck` — clean
- ✅ `pnpm --filter @school/admin build` — 36/36 pages
- ✅ lint guardrail — passes
- All student-record functionality preserved (edit, vaccines, parent links, finance statement).

---

## 5. Roadmap (apply the exemplar)

| Item | Records | Notes |
|---|---|---|
| Apply Tabs workspace composition | Teacher, Parent, Employee | mirror the Student pattern (Overview / Relationships / domain tabs) |
| Build domain cards/tables for headers/summaries | StudentCard, GuardianSummary, InvoiceTable, BalanceCard, AgingCard | Phase 5 “next wave”, now slot into these workspaces |
| **Timeline (activity feed)** | all records | **Phase 10** — needs activity API |
| **Audit Trail** surface | Student, Finance, Attendance | **Phase 10** — needs audit-log API |
| Promote dialogs → dedicated workspace **routes** | all | out of current scope (would add routes) — propose separately if desired |

---

## 6. STOP — Phase 6 (assessment + Student exemplar) Complete

All record views assessed against the Workspace pattern; the Student record is now a compliant tabbed workspace and the reference for the rest; Timeline/Audit correctly deferred to Phase 10; build green; no routes/APIs/logic changed.

**Awaiting approval to begin Phase 7 (Search Architecture)** — verifying global/entity search, filters, saved searches, search states, keyboard navigation, and accessibility.
