# DOMAIN_COMPONENT_REPORT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration
**Phase:** 5 — Domain Component Migration
**Date:** 2026-06-18
**Branch:** `claude/affectionate-shannon-fbfeaf`
**Status:** ✅ High-impact slice complete + EmptyState rollout finished (build-verified). Awaiting approval before Phase 6.

> Composition-only. **No business logic, APIs, schemas, routes, or workflows changed.**

---

## 1. Scope (per governance decisions)

- **Domain priority:** high-impact first — eliminate the duplicated status→tone maps scattered across modules with reusable domain components.
- **Also this phase:** complete the **EmptyState rollout** to the remaining modules (started in Phase 4).

Domain **cards/tables** (StudentCard, InvoiceTable, BalanceCard, AgingCard, ReportCard, …) are the larger, data-shape-coupled abstractions; they are scoped as the **next domain wave** (§5) since they overlap heavily with the Record Workspace work in Phase 6.

---

## 2. Domain-Component Layer Established

New folder **`apps/admin/src/components/domain/`** with a barrel `index.ts`. These compose `@school/ui` primitives and depend on app enums/i18n, so they correctly live in the app (not the generic `@school/ui`), each owning the **single source of truth** for its domain's status colours.

| Component | Domain | Replaces (was duplicated) | Applied in |
|---|---|---|---|
| **ChargeStatusBadge** | Finance | `CHARGE_TONE` map (used ×2 inline) | finance (statement + charges) |
| **TransactionStatusBadge** | Finance | `TXN_TONE` map (used ×2 inline) | finance (payments + refunds) |
| **ClinicOutcomeBadge** | Clinic | `OUTCOME_TONE` map | clinic (recent visits) |
| **LoanStatusBadge** | Library | inline 3-way tone ternary | library (loans) |
| **EmploymentStatusBadge** | HR/People | re-exports existing `StatusBadge` | (available; employees keeps current import) |

### Impact
- **finance/page.tsx**: removed both local `CHARGE_TONE`/`TXN_TONE` consts; 4 inline `Badge` usages → 2 domain components. `Badge` retained only where genuinely generic (status tags).
- **clinic/page.tsx**: removed `OUTCOME_TONE`; dropped now-unused `Badge` import.
- **library/page.tsx**: replaced the inline loan-status ternary; dropped now-unused `Badge` import.
- The domain badges are now the only place these status palettes are defined — future status additions happen in one file per domain.

---

## 3. EmptyState Rollout — Completed

The standardized `EmptyState` (added in Phase 4) is now applied to **every in-table empty row** across the remaining modules (15 sites, 9 files): structure/academic (×3), library (×2), finance (×2), finance/fee-plans, presence, academics (×2), clinic, inventory (×2), communication. Together with the People module (Phase 4), **all table empty states now use one consistent pattern.**

> The few remaining bare `<p>`/`<li>` *inline hints* (e.g. dashboard “no recent activity”, fleet sub-lists, structure schools/campuses lists) are intentionally left as lightweight inline text — promoting every one-line hint to a full `EmptyState` block would be visually heavier than the context warrants. Noted as optional polish.

---

## 4. Verification

- ✅ `pnpm --filter @school/admin typecheck` — clean
- ✅ `pnpm --filter @school/admin build` — 36/36 pages
- ✅ Design-system ESLint guardrail — passes
- ✅ Removed-import cleanup verified (no unused `Badge`/tone consts left dangling)

---

## 5. Next Domain Wave (roadmap — overlaps Phase 6)

The reference DS catalogs 40+ domain components. The remaining high-value ones are **data-shape-coupled cards/tables**, best built alongside the Record Workspace pattern (Phase 6) so they slot into workspace headers/summaries:

| Component(s) | Module | Pairs with |
|---|---|---|
| StudentCard, StudentTable, EnrollmentStatus, GuardianSummary | People/Students | Phase 6 Student Workspace |
| TeacherCard, ParentCard | People | Phase 6 |
| InvoiceTable, InvoiceCard, BalanceCard, FeeStatusCard, AgingCard, CollectionSummary | Finance | Phase 6 Finance Workspace + Phase 10 audit |
| AttendanceCard, AttendanceStatusBadge, AttendanceSummary, ClassAttendanceWidget | Attendance | Phase 11 (keyboard) |
| ReportCard, ReportFilterBar, ExportStatus | Reports | Phase 4 dashboard reshape |
| BusCard, RouteCard, DriverCard | Transport | — |
| AnnouncementCard, NotificationCard | Communication | — |

> Recommendation: build the **People + Finance** domain cards/tables as part of **Phase 6 (Workspace Architecture)**, where they have a natural home, rather than as standalone widgets now.

---

## 6. STOP — Phase 5 (high-impact slice) Complete

Domain-component layer established with 5 status components eliminating scattered tone-map duplication; EmptyState rollout finished across all tables; build green; logic/APIs/routes untouched.

**Awaiting approval to begin Phase 6 (Workspace Architecture)** — verifying/establishing the Record Workspace pattern (header → summary → actions → tabs → timeline → related records → audit trail) for Student/Teacher/Parent/Finance workspaces, building the People + Finance domain cards/tables as part of it.
