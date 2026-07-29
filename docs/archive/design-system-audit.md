# DESIGN_SYSTEM_AUDIT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration
**Phase:** 1 — Full Application Audit
**Date:** 2026-06-18
**Branch:** `claude/affectionate-shannon-fbfeaf`
**Scope:** `apps/admin` — all 29 routes
**Status:** ✅ Complete — awaiting approval before Phase 2

> Audit only. **No application code, tokens, components, schemas, APIs, or routes were modified.**

---

## 1. Overall Compliance Score

### 🎯 **66 / 100** (Overall, weighted)

The product is **strong on foundations** (tokens, dark mode, RTL) and **weak on the design system's higher-order layers** (domain components, record/workspace patterns, full a11y). Token discipline is excellent; the gap is structural — there is no shared component/domain layer, so every page hand-rolls composition.

### Dimension breakdown

| Dimension | Score | Weight | Notes |
|---|---|---|---|
| **Token compliance** | 95 | 15% | Near-perfect. Only 2 hotspots (reports print CSS, attendance TONE map) |
| **Core component usage** | 75 | 15% | Primitives used everywhere, but raw `<button>/<input>/<textarea>/<table>/<checkbox>` leak in ~17 pages |
| **Domain component compliance** | 10 | 15% | Essentially none built (StudentCard, InvoiceTable, AttendanceStatusBadge…) |
| **Pattern compliance** | 45 | 15% | CRUD-ish lists exist; no Workspace/Search/Audit patterns; many missing empty/error states |
| **Accessibility** | 60 | 15% | Field/label gaps, missing `aria-label` on icon/text buttons, no `<th scope>` |
| **RTL** | 88 | 12.5% | Logical properties used widely; a few physical classes; `dir` overrides are correct |
| **Dark mode** | 95 | 12.5% | Theme-aware CSS-var tokens throughout |

> **Page-level score** (token + component view only) is higher at ~**72/100** (COMPLIANT=100, PARTIAL=65, NON=35 averaged). The **domain-component and pattern dimensions are what pull the weighted total down to 66** — and those are exactly the Phase 3–6 work.

### Classification distribution (29 pages)

| Classification | Count | Pages |
|---|---|---|
| 🟢 **COMPLIANT** | 8 | fee-plans, presence, settings/users, settings/attendance, modules, login, change-password, kitchen-sink |
| 🟡 **PARTIALLY_COMPLIANT** | 18 | dashboard, students, employees, cards, structure/schools, structure/academic, finance, attendance, academics, timetable, reports, communication, roles, jofotara, clinic, fleet, library, platform/databases |
| 🔴 **NON_COMPLIANT** | 3 | teachers, parents, inventory |

---

## 2. Cross-Cutting Findings (systemic, affect many pages)

These are the highest-leverage issues — fixing them at the component/package level resolves dozens of page-level violations at once.

| # | Finding | Severity | Pages affected | Resolved in |
|---|---|---|---|---|
| **X1** | **Form inputs not wrapped in `Field`** → no associated `<label>`, placeholder-only. Major a11y gap. | 🔴 High | teachers, parents, inventory, library, clinic, jofotara (partial) | Phase 3/11 |
| **X2** | **Missing primitives in `@school/ui`**: no `Textarea`, `Checkbox`, `Radio`, `Switch`, `Dialog/Drawer`, `Tabs`, `Pagination`, `Tooltip`. Pages hand-roll raw `<textarea>`, `<input type=checkbox>`, and modal markup. | 🔴 High | academics, communication (textarea); students, employees, academic, users, roles (checkbox); all modal pages | Phase 3 |
| **X3** | **Zero domain components.** StudentCard, StudentTable, TeacherCard, GuardianSummary, InvoiceTable, InvoiceCard, FeeStatusCard, BalanceCard, AgingCard, AttendanceCard, AttendanceStatusBadge, ClassAttendanceWidget, ReportCard, ReportFilterBar — none exist. | 🟡 Med | finance, students, teachers, parents, attendance, reports, cards | Phase 5 |
| **X4** | **Raw `<button>` instead of `Button`** (often clickable text/links/toggles). | 🟡 Med | students, employees, finance, attendance, schools, roles, jofotara, fleet, databases, academic, users | Phase 3 |
| **X5** | **`Table` primitive emits no `scope` on `<th>`**; one page uses a fully raw `<table>` (timetable). | 🟡 Med | timetable (raw), + all tables (scope) | Phase 3/11 |
| **X6** | **Errors caught but not surfaced** to the user (only `console`/silent). | 🟡 Med | teachers, parents, structure/schools | Phase 4 |
| **X7** | **Record Workspace pattern absent.** People/Finance detail views are modals/panels, not the header→summary→tabs→timeline→related→audit workspace. | 🟡 Med | students, teachers, parents, finance, employees | Phase 6 |
| **X8** | **No global Search, saved searches, or audit-trail UI** surfaced. | 🟡 Med | app-wide | Phase 7/10 |
| **X9** | **Hardcoded colors** — `reports` print stylesheet (`black`, `dimgray`, `rgb(243,240,250)`, `lightgray`); `attendance` TONE map mixes `text-white`/`text-ink-900`. | 🟢 Low | reports, attendance | Phase 2 |
| **X10** | **Dashboard not following Dashboard Pattern** — 6 KPIs (spec: ≤4), no trends/deltas, no exceptions, no explicit "next action". | 🟢 Low | dashboard | Phase 4 |

---

## 3. Per-Page Audit

Severity legend: 🔴 High · 🟡 Med · 🟢 Low. Effort: S (<½ day) · M (½–2 days) · L (>2 days).

### Module: Dashboard

| Route | File | Class | Violations | Sev | Effort |
|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | 🟡 PARTIAL | Doesn't follow Dashboard Pattern (6 KPIs, no trends/exceptions/next-action); `Kpi`/`Bar` are local, not shared; inline `style` for bar width (acceptable). Tokens/states clean. | 🟢 | S |

### Module: People

| Route | File | Class | Key Violations | Sev | Effort |
|---|---|---|---|---|---|
| `/people/students` | `people/students/page.tsx` | 🟡 PARTIAL | 3 raw `<button>`, 1 raw `<textarea>`, 1 raw checkbox; no pagination; missing aria-labels. States complete. Opps: StudentCard, StudentTable, EnrollmentStatus. | 🟡 | M |
| `/people/teachers` | `people/teachers/page.tsx` | 🔴 NON | Form inputs **bare (no Field/labels)**; error caught but not shown; no search/filters/detail. Opps: TeacherCard, TeacherTable. | 🔴 | M |
| `/people/parents` | `people/parents/page.tsx` | 🔴 NON | Form inputs **bare (no Field/labels)**; error not surfaced; no search/detail. Opps: ParentCard, GuardianSummary. | 🔴 | M |
| `/people/employees` | `people/employees/page.tsx` | 🟡 PARTIAL | 2 raw `<button>` (name links), raw checkbox; otherwise complete (KPIs, filters, states). Opps: EmployeeCard/Table. | 🟡 | M |
| `/people/cards` | `people/cards/page.tsx` | 🟡 PARTIAL | Raw `<Select>` in table cell w/o label; missing loading state. Opps: CardStatusBadge, CardTable. | 🟡 | M |

### Module: Structure

| Route | File | Class | Key Violations | Sev | Effort |
|---|---|---|---|---|---|
| `/structure/schools` | `structure/schools/page.tsx` | 🟡 PARTIAL | 1 raw `<button>` (school name); error not surfaced. Opps: SchoolCard, CampusCard. | 🟢 | S |
| `/structure/academic` | `structure/academic/page.tsx` | 🟡 PARTIAL | Raw checkboxes; nested delete buttons lack aria-label; no visual loading on cascades. Opps: GradeEditor, ClassroomCard. | 🟡 | M |

### Module: Finance

| Route | File | Class | Key Violations | Sev | Effort |
|---|---|---|---|---|---|
| `/finance` | `finance/page.tsx` | 🟡 PARTIAL | 1 raw `<button>`; no domain components. States good, Finance Pattern largely present. Opps: InvoiceTable, BalanceCard, FeeStatusCard, PaymentCard, AgingCard, CollectionSummary. | 🟡 | M |
| `/finance/fee-plans` | `finance/fee-plans/page.tsx` | 🟢 COMPLIANT | Clean; minor: no audit trail/batch ops. | 🟢 | S |

### Module: Attendance / Presence

| Route | File | Class | Key Violations | Sev | Effort |
|---|---|---|---|---|---|
| `/attendance` | `attendance/page.tsx` | 🟡 PARTIAL | ~7 raw `<button>` status toggles (have aria-label but not Button); TONE map hardcodes color classes; no keyboard shortcuts. Opps: AttendanceStatusBadge, AttendanceCard, ClassAttendanceWidget. | 🟡 | M |
| `/presence` | `presence/page.tsx` | 🟢 COMPLIANT | Clean; states complete. | 🟢 | S |

### Module: Academics / Timetable

| Route | File | Class | Key Violations | Sev | Effort |
|---|---|---|---|---|---|
| `/academics` | `academics/page.tsx` | 🟡 PARTIAL | Raw `<textarea>` (CSV import) — no Textarea primitive. States present. | 🟡 | M |
| `/timetable` | `timetable/page.tsx` | 🟡 PARTIAL | **Raw `<table>`/`<th>`** (bypasses Table primitive, no scope, no ARIA). Read-only. | 🟡 | M |

### Module: Reports / Communication

| Route | File | Class | Key Violations | Sev | Effort |
|---|---|---|---|---|---|
| `/reports` | `reports/page.tsx` | 🟡 PARTIAL | **Print stylesheet hardcodes colors** (black/dimgray/rgb/lightgray); `<th>` lacks scope; no freshness indicator. Opps: ReportCard, ReportFilterBar, ExportStatus. | 🟡 | M |
| `/communication` | `communication/page.tsx` | 🟡 PARTIAL | Raw `<textarea>`; no audit/scheduling. Opps: AnnouncementCard, AudienceSelector. | 🟢 | S |

### Module: Settings

| Route | File | Class | Key Violations | Sev | Effort |
|---|---|---|---|---|---|
| `/settings/users` | `settings/users/page.tsx` | 🟢 COMPLIANT | Minor: raw checkbox not in Field. | 🟢 | S |
| `/settings/roles` | `settings/roles/page.tsx` | 🟡 PARTIAL | Raw checkboxes + raw select-all button (missing `type`); no Field wrap. | 🟢 | S |
| `/settings/attendance` | `settings/attendance/page.tsx` | 🟢 COMPLIANT | Clean (Spinner, Field, auto-save). | 🟢 | S |
| `/settings/integrations/jofotara` | `settings/integrations/jofotara/page.tsx` | 🟡 PARTIAL | 4 raw `<button>` wizard steps (no aria-current); some inputs lack clear labels. | 🟡 | M |

### Module: Operations (Clinic / Fleet / Inventory / Library)

| Route | File | Class | Key Violations | Sev | Effort |
|---|---|---|---|---|---|
| `/clinic` | `clinic/page.tsx` | 🟡 PARTIAL | Medical-record form inputs **not in Field** (a11y). States good. | 🟡 | M |
| `/fleet` | `fleet/page.tsx` | 🟡 PARTIAL | 1 raw `<button>` toggle (needs aria-expanded). Otherwise solid. | 🟢 | S |
| `/inventory` | `inventory/page.tsx` | 🔴 NON | **All form inputs lack Field/labels** (CreateItem, RecordTxn). | 🔴 | M |
| `/library` | `library/page.tsx` | 🟡 PARTIAL | Form inputs lack Field wrapping (less severe than inventory). | 🟡 | M |

### Module: Platform / Admin / Auth

| Route | File | Class | Key Violations | Sev | Effort |
|---|---|---|---|---|---|
| `/modules` | `modules/page.tsx` | 🟢 COMPLIANT | Clean; toggles use `aria-pressed`. | 🟢 | S |
| `/platform/databases` | `platform/databases/page.tsx` | 🟡 PARTIAL | 1 raw `<button>` toggle (needs ARIA); no explicit loading; wizard lacks `aria-live`. | 🟢 | S |
| `/login` | `login/page.tsx` | 🟢 COMPLIANT | Exemplary (Field + htmlFor, error state). | 🟢 | S |
| `/change-password` | `change-password/page.tsx` | 🟢 COMPLIANT | Exemplary. | 🟢 | S |
| `/kitchen-sink` | `kitchen-sink/page.tsx` | 🟢 COMPLIANT | DS showcase / reference. | 🟢 | S |

---

## 4. Effort Roll-Up

| Effort | Pages | Est. range |
|---|---|---|
| **S** | 13 | quick fixes (button→Button, add aria, surface errors) |
| **M** | 16 | Field wrapping, raw-element replacement, domain components |
| **L** | 0 page-level | (the L work is package-level: building primitives + domain components, Phases 3 & 5) |

**Note:** the largest true effort is **not page-by-page** — it is the **package-level build-out** in Phases 3 (missing primitives) and 5 (domain components). Doing those first makes most M pages collapse to S.

---

## 5. Recommended Sequencing (feeds later phases)

1. **Phase 2 — Tokens:** add missing scales (spacing, z-index, motion, semantic success/warning/info) to `@school/config-tailwind` from reference values; fix reports print CSS + attendance TONE map. (Low risk, high cleanliness.)
2. **Phase 3 — Core components:** build the missing primitives into `@school/ui` — **Textarea, Checkbox, Radio, Switch, Dialog/Drawer, Tabs, Pagination, Tooltip** — plus add `scope` to `Table`. Then sweep raw `<button>/<input>/<textarea>/<table>/<checkbox>` → primitives. **This alone fixes X1, X2, X4, X5 and reclassifies teachers/parents/inventory out of NON_COMPLIANT.**
3. **Phase 4 — Patterns:** standardize empty/loading/error states; reshape dashboard to Dashboard Pattern; surface caught errors.
4. **Phase 5 — Domain components:** StudentCard/Table, InvoiceTable, AttendanceStatusBadge, FeeStatusCard, ReportCard, etc.
5. **Phases 6–14** per program.

---

## 6. STOP — Phase 1 Complete

No files modified. **Overall compliance: 66/100.** 8 compliant, 18 partial, 3 non-compliant.

**Awaiting approval to begin Phase 2 (Token Migration).** Per the resolved governance decisions, Phase 2 will extend `@school/config-tailwind` with the reference system's missing token scales (never inventing values) and remediate the two hardcoded-color hotspots.
