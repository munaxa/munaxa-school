# ENROLLMENT & BILLING — ARCHITECTURAL AUDIT & IMPACT REPORT

**Author role:** ERP / School-OS Architect
**Date:** 2026-06-19 · Branch `claude/affectionate-shannon-fbfeaf`
**Status:** 🛑 Audit & gap analysis for approval — **no code written**. Goal: **extend**, not replace.

> Scope audited: Prisma schema; `apps/api/src/finance/{charges,transactions,ledger,statement,fee-plans,collections}`, `einvoicing`, `reporting`, `advanced/bus`, `people`, `communication`, `common`; `apps/admin` finance/fee-plans/reports/people UI. Citations are `file:line`.

---

## PHASE 1 — Existing Architecture Map

### Finance core (mature — reuse)
- **Ledger model:** `Charge` (per-student, `amount`, `dueDate`, `status`, **`installmentPlanId`** grouping, `feePlanId?`), `Transaction` (payments, `PENDING→VERIFIED/REJECTED`), **`PaymentAllocation`** (txn→charge, soft-reversible via `reversedAt`), **`FeeAdjustment`** (= discount/scholarship/sibling/staff/waiver/credit-memo/correction, fixed or %), **`Refund`** (against account credit). Money always recomputed from rows (no denormalized balances). `billing.repository.ts: recomputeCharge / accountSummary`.
- **Installments:** `charge.service.createInstallments` — splits a total into N equal parts (last absorbs remainder), **monthly** due dates, **one active plan/student**, bounds **2–60**. `payInstallment` records a payment and **rebalances surplus onto latest-due-first** installments (schedule amounts never change). `ledger.allocate` = manual allocation. **Auto-allocate on verify** targets a single `chargeId` only.
- **Statement:** `GET /finance/students/:id/statement` (charged/paid/outstanding/discounts/credits/refunded/creditBalance + per-charge balances). **Household:** `GET …/household` → siblings + outstanding.
- **Collections:** `StudentBillingProfile` (manual tag `NONE/FINANCIAL_ISSUE/LEGAL`), `PaymentReminder` (persisted sends), on-the-fly `snapshot` (outstanding/dueThisMonth/overdue), in-app reminders (real) + SMS (stub). Per-student only.
- **E-invoicing:** JoFotara module issues tax e-invoices from a charge (`einvoicing/jofotara`).
- **Reporting:** attendance/academic/**financial**/behavior + **export CSV/XLSX/PDF** (`reporting/export`, pdfkit+exceljs). Financial report = per-student charged/paid/outstanding only.
- **Audit:** `AuditLog` model is **rich** (`before/after/actorRole/ip/userAgent/traceId`), but the `TenantRepository.writeAudit` helper only writes `action/entityType/entityId/metadata` **inside the same transaction**. ~13 repositories emit finance audit events.
- **Frontend:** `apps/admin/src/lib/finance.ts` (full API client) + `finance/page.tsx` (per-student workspace: charges, balances, pay, discount, installments, statement, household, collections panel, refunds) + `fee-plans/page.tsx` (flat catalog) + `reports/page.tsx`.

### Adjacent (reuse as-is)
- **People:** Student/Parent/`ParentStudent`/Section/Grade CRUD; sibling detection (`billing.repository.siblingsOf`). **Transport:** `Bus*`/`StudentBusAssignment` = **logistics/GPS only** (no fee). **Structure:** `AcademicYear`/`Semester`/`Grade`. **DS UI:** `@school/ui` + domain components (RecordHeader, ParentProfileDialog, status badges) + `Timeline`, `EmptyState`.

---

## PHASE 2 — Gap Analysis Matrix

| # | Feature (spec) | Exists | Partial | Missing | Recommended action |
|---|---|:--:|:--:|:--:|---|
| 1 | Student registration | ✅ | | | Reuse (Student CRUD) |
| 2 | Per-**grade** + per-**academic-year** fee config, effective dates, versions | | ✅ | | **Extend** — `FeePlan` is flat/global; add grade/AY-scoped schedule |
| 3 | Registration fee calc | | ✅ | | **Extend** — presets are description-only; drive from schedule |
| 4 | Annual tuition calc | | ✅ | | **Extend** — same |
| 5 | Transportation fee config + calc (none/one-way/two-way, per AY) | | | ❌ | **Implement** — `TransportFare` + assignment direction |
| 6 | Discount engine (rules, eligibility, dates, max) | | ✅ | | **Extend** — `FeeAdjustment` = applications; add `DiscountRule` + auto-calc |
| 7 | Full-payment discount + prompt + formula | | | ❌ | **Implement** (rule type + enrollment branch) |
| 8 | Installment plans | ✅ | ✅ | | **Extend** — promote to `InstallmentPlan` entity; bounds 1–9 configurable |
| 9 | Installment schedule generation (monthly/custom) | ✅ | ✅ | | **Extend** — monthly exists; add custom + 1-installment |
| 10 | Down payment / initial payment at enrollment | | | ❌ | **Implement** (enrollment takes initial payment) |
| 11 | Payment allocation **FIFO (oldest first)** | | ✅ | | **Extend** — today: single-charge auto / latest-first rebalance / manual. Add oldest-first FIFO option |
| 12 | Allocation reversal / corrections | | ✅ | | **Extend** — schema has `reversedAt`; add reverse flow + audit |
| 13 | Installment statuses incl **OVERDUE** | | ✅ | | **Extend** — derive OVERDUE (don't break `recomputeCharge`) |
| 14 | Overdue tracking | ✅ | | | Reuse (collections snapshot) |
| 15 | Collections **levels** (good/follow-up/critical, auto) | | ✅ | | **Extend** — manual tag → auto-derived level |
| 16 | Collections **dashboard** (portfolio) | | | ❌ | **Implement** (queue + metrics) |
| 17 | Payment promises | | | ❌ | **Implement** (on `CollectionCase`) |
| 18 | Transportation suspension rules + auto-restore | | | ❌ | **Implement** (policy + `TransportationStatus`) |
| 19 | Parent communication log (channels/outcomes) | | | ❌ | **Implement** (`CommunicationLog`) |
| 20 | Administrative holds | | | ❌ | **Implement** (`AdministrativeHold` + enforcement points) |
| 21 | Enrollment workflow + entity | | | ❌ | **Implement** (`Enrollment`/`EnrollmentStudent`) orchestrating reuse |
| 22 | Enrollment agreement PDF | | | ❌ | **Implement** (reuse pdfkit) |
| 23 | Invoice / Receipt / Credit-note / Voucher PDF | | ✅ | | **Extend** — only JoFotara e-invoice today; add document generation + numbering |
| 24 | Financial summary (reg/tuition/transport/discount/paid/remaining/next due/overdue) | | ✅ | | **Extend** statement totals (split by fee kind + next due + overdue) |
| 25 | Reports: revenue / transport revenue / collection effectiveness / account statements | | ✅ | | **Extend** reporting module (reuse export) |
| 26 | Audit before/after values | | ✅ | | **Extend** `writeAudit` to capture before/after |
| 27 | Multi-tenant + tenant isolation | ✅ | | | Reuse (every model has `tenantId`, scoped repos) |

**Net:** ~7 reuse · ~12 extend · ~8 implement. The financial *primitives* (charges, payments, allocations, adjustments, refunds, audit, export) are solid; the gaps are the **enrollment orchestration, configuration layer, automation (discount/transport/collections rules), and document generation**.

---

## PHASE 3 — Architecture Plan (extend, don't replace)

**Principle:** the existing `Charge`/`Transaction`/`PaymentAllocation`/`FeeAdjustment` ledger stays the **system of record for money**. New work is (a) a **configuration layer**, (b) an **enrollment orchestration service** that composes existing charge/installment/discount calls, (c) **automation rules**, and (d) **document/reporting** on top. Reuse `writeAudit`, `Statement`, `export.service`, `@school/ui`.

### Reuse directly (no change)
`Transaction`, `PaymentAllocation`, `Refund`, `FeeAdjustment` (= `DiscountApplication`), `Statement`/`accountSummary`, `PaymentReminder`, `AuditLog`, `Bus*`, `Student`/`Parent`/`Grade`/`AcademicYear`/`Section`, reporting `export.service`, DS components.

### Map spec entities → implementation (avoid duplicates)
| Spec entity | Decision |
|---|---|
| Parent, Student, AcademicYear, Grade | **Reuse** existing models |
| FeeStructure | **New** `GradeFeeSchedule` (grade × AY × effectiveFrom/To: registration + tuition) — *do not* overload flat `FeePlan` |
| TransportationPlan | **New** `TransportFare` (AY × direction × amount) |
| DiscountRule | **New** `DiscountRule`; **DiscountApplication = reuse `FeeAdjustment`** |
| Enrollment, EnrollmentStudent | **New** (orchestration record per AY; links student+grade+section+transport+plan+fee snapshot) |
| InstallmentPlan | **New** thin metadata entity keyed by the existing `Charge.installmentPlanId`; **Installment = reuse `Charge`** |
| Invoice, InvoiceItem | **New** lightweight doc+numbering over existing charges (or generate-on-read) |
| Payment, PaymentAllocation | **Reuse** `Transaction` + `PaymentAllocation` |
| Receipt | **New** numbering/doc over `Transaction` |
| CommunicationLog | **New** |
| CollectionCase | **New** (promotes computed snapshot to a tracked case w/ level + promises); reuse `StudentBillingProfile`+`PaymentReminder` |
| TransportationStatus | **New** (or status fields on `StudentBusAssignment`) + suspension policy |
| AdministrativeHold | **New** + enforcement hooks |
| AuditLog | **Reuse** (extend helper for before/after) |

### Service layering (clean architecture, matches existing Nest structure)
- `finance/fee-config/` — GradeFeeSchedule, TransportFare, DiscountRule, BillingPolicy (installment 1–9, full-pay %, suspension threshold) CRUD.
- `enrollment/` — `EnrollmentService.quote()` (compute reg+tuition+transport−discounts, full-pay vs installment, schedule preview) and `enroll()` (transaction: create EnrollmentStudent → charges (reusing charge.service) → installment plan → apply discount adjustments → take down payment via transaction+FIFO allocate → emit audit).
- `finance/collections/` — extend: auto level derivation, dashboard/queue, payment promises.
- `transport-billing/` — fares, assignment-direction charge generation, suspension evaluator + auto-restore.
- `communication-log/`, `admin-holds/` — new small modules.
- `documents/` — PDF agreement/invoice/receipt/voucher (reuse pdfkit from `reporting/export`).
- `reporting/` — extend with revenue / transport-revenue / collection-effectiveness / account-statement report kinds (reuse export).

---

## PHASE 4 — Impact Report

### 4.1 Database changes (all **additive** — no column drops/renames; no breaking enum edits)
**New models:** `GradeFeeSchedule`, `TransportFare`, `DiscountRule`, `BillingPolicy`, `Enrollment`, `EnrollmentStudent`, `InstallmentPlan`, `CommunicationLog`, `AdministrativeHold`, `CollectionCase`, `InvoiceDoc`/`ReceiptDoc` (sequential numbering). Each carries `tenantId/createdAt/updatedAt/createdBy/updatedBy` per the multi-tenant rule.
**Additive columns:** `StudentBusAssignment.{direction, transportFareId, billingStatus}`; `Charge.{kind?(REGISTRATION/TUITION/TRANSPORT/OTHER), enrollmentStudentId?}`; optional `InstallmentPlan` FK mirrored by existing `Charge.installmentPlanId`.
**Enums:** add `CommunicationChannel`, `CommunicationOutcome`, `DiscountType`, `DiscountCalc`, `TransportDirection`, `HoldType`, `CollectionLevel`, `TransportBillingStatus`. **Do not** modify `ChargeStatus` (OVERDUE stays derived) to avoid breaking `recomputeCharge`.
**Migrations:** additive Prisma migrations; backfill optional (existing charges get `kind=OTHER`). Zero data loss.

### 4.2 API changes (new routes; existing routes unchanged)
- `finance/fee-config/*` (GradeFeeSchedule, TransportFare, DiscountRule, BillingPolicy) — CRUD, `FINANCE_MANAGE`.
- `enrollment/*` — `POST /enrollment/quote`, `POST /enrollment` (enroll), `GET /enrollment/:id`.
- `transport-billing/*` — fares + assignment direction + suspension status.
- `finance/collections/*` — **add** `GET /collections/dashboard`, `GET /collections/queue`, promise endpoints (existing per-student endpoints unchanged).
- `communication-log/*`, `admin-holds/*` — CRUD.
- `documents/*` — agreement/invoice/receipt/voucher PDF.
- `reporting/*` — new report kinds (reuse export controller pattern).
- New permissions (e.g. `ENROLLMENT_MANAGE`, `FEECONFIG_MANAGE`, `COLLECTIONS_MANAGE`, `HOLD_MANAGE`) added to the role catalog.

### 4.3 UI changes (reuse DS + finance workspace)
- **Enrollment wizard** (new route `/enrollment/new`): parent → students → grade/section/transport → live fee **quote** (full-pay vs installments 1–9) → down payment → confirm → agreement PDF. Reuse `Tabs`, `Field`, `EntityPicker`, `RecordHeader`, `Dialog`.
- **Fee configuration** pages (extend `/finance/fee-plans` into a config hub: grade schedules, transport fares, discount rules, policy).
- **Collections dashboard** (new `/finance/collections`): portfolio metrics + queue + level badges + promises + suspension. (Per-student panel already in finance workspace.)
- **Document buttons**: agreement/invoice/receipt/voucher print on the student finance workspace.
- **Communication log** + **holds** + **transport status** surfaced in Student & Parent record workspaces (reuse `Timeline`, status badges).
- Financial summary card extended (reg/tuition/transport split, next due, overdue, level).

### 4.4 Migration plan (phased, each build-verified, gated)
1. **Config layer** — GradeFeeSchedule, TransportFare, DiscountRule, BillingPolicy (models + CRUD + UI). *No behavior change to existing flows.*
2. **Enrollment quote+enroll** — orchestration over existing charge/installment/discount services + down payment; agreement PDF.
3. **Transport billing + suspension** — fares→charges, suspension evaluator + auto-restore.
4. **Discount engine automation** — sibling/full-payment/scholarship/promo auto-apply via `FeeAdjustment`.
5. **Collections upgrade** — auto levels, dashboard/queue, promises; communication log; admin holds + enforcement.
6. **Documents + reports** — invoice/receipt/voucher; revenue/transport/collection-effectiveness/account-statement reports; audit before/after.
Each phase: additive migration → service → API → UI → `typecheck`+`build` → report → STOP.

### 4.5 Risks
- **Money-path regressions** — mitigate by keeping `Charge`/allocation recompute untouched; enrollment only *composes* existing audited calls; add tests around quote math.
- **FIFO vs existing latest-first rebalance** — two allocation strategies; make ordering explicit/configurable, default enrollment down-payment to **oldest-first FIFO** (spec) without changing `payInstallment`’s rebalance.
- **Migration on live tenants** — additive only; backfill defaults; no destructive changes.
- **PDF/locale (Arabic/RTL)** — agreements bilingual; pdfkit Arabic shaping needs a suitable font (verify).
- **Permission surface growth** — add to catalog + governance.
- **Scope size** — large; the phased gates contain risk.

### 4.6 Estimated complexity
| Phase | Complexity | Notes |
|---|---|---|
| 1 Config layer | **M** | additive models + CRUD + UI |
| 2 Enrollment quote/enroll + agreement | **L** | orchestration + math + PDF |
| 3 Transport billing + suspension | **M** | fares + evaluator |
| 4 Discount engine | **M** | rules + auto-apply over `FeeAdjustment` |
| 5 Collections/comms/holds | **L** | levels + dashboard + 3 new modules + enforcement |
| 6 Documents + reports + audit before/after | **M–L** | reuse export/pdfkit |

**Overall: Large** (multi-week), but **~60% leverages existing primitives**. No module is rewritten.

---

## 🛑 STOP — Awaiting approval

This is the **audit + gap analysis + impact report only**. No code, schema, or API has been changed.

**Decisions I need before implementing:**
1. **Approve the entity reuse decisions** in Phase 3 (esp. `Installment = Charge`, `DiscountApplication = FeeAdjustment`, OVERDUE stays derived) — or do you want standalone tables matching the spec's entity list 1:1?
2. **Backend changes are now in scope** (this reverses the earlier "preserve schema/APIs" guardrail). Confirm I may add additive Prisma models/migrations + new API modules.
3. **Sequencing:** start with **Phase 1 (config layer)** as proposed, or a different first slice?
4. **Installment bounds:** spec says 1–9; current is 2–60. Make it a configurable `BillingPolicy` (default 1–9) — OK?

On approval I'll implement phase-by-phase with the same assess→build→verify→report→gate cadence.
