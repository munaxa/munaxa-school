# Registration, Re-Enrollment, Quotation & Payment Planning — Gap Analysis

> Status: **ANALYSIS ONLY — awaiting approval before implementation.**
> Scope: Admissions/registration workflow built **on top of** the existing Finance, Billing Ledger,
> Fee Configuration, JoFotara, Student, Parent, and Enrollment modules. No existing module is rewritten.

---

## 1. Repository Analysis (what exists today)

**Stack:** Turborepo monorepo · NestJS API (`apps/api`) · Next.js 15 App Router admin (`apps/admin`) ·
Prisma + PostgreSQL with **RLS-enforced multi-tenancy** · shared packages (`@school/domain`, `@school/ui`, `@school/i18n`).

**Tenancy & security baseline (reuse as-is):**
- `TenantRepository.run()` wraps every unit of work in `withTenant(...)` → Postgres RLS scopes by `app_current_tenant()`. New tables get the standard `tenant_isolation` policy (pattern in `20260619120000_enrollment_billing_config/migration.sql`).
- `writeAudit(tx, ...)` writes an `AuditLog` row **inside the same transaction** as the state change (mandatory for financial actions). Audit logs are append-only.
- RBAC via `@RequirePermissions(Permission.X)`; permission catalog in `packages/domain/src/permissions.ts`; role→permission seed in `role-permissions.ts`. Roles already include **Registrar, FinanceOfficer, Accountant, SchoolAdmin**.

**Finance & billing (already implemented — high reuse):**
| Concern | Existing asset |
|---|---|
| Per-grade/year registration + tuition fees, effective-dated | `GradeFeeSchedule` |
| Transport fares by direction (`NONE`/`ONE_WAY`/`TWO_WAY`) per year | `TransportFare` |
| Discount rules (`FULL_PAYMENT`/`SIBLING`/`SCHOLARSHIP`/`PROMOTIONAL`/`MANUAL`, FIXED/PERCENT, maxAmount, date ranges, `appliesToTransport`) | `DiscountRule` |
| Installment bounds (min/**max = 9**), full-payment discount %, transport suspension | `BillingPolicy` |
| Charges, installment grouping | `Charge` (has `installmentPlanId`) |
| Payments + verification | `Transaction`, `TransactionService` |
| Deductions / credits | `FeeAdjustment` (SCHOLARSHIP/DISCOUNT/SIBLING/STAFF/WAIVER/CREDIT_MEMO/CORRECTION) |
| Payment-to-charge allocation | `PaymentAllocation`, `LedgerService.allocate` |
| Refunds, collections, reminders | `Refund`, `StudentBillingProfile`, `PaymentReminder` |
| **Installment split (fils-based, last absorbs remainder)** | `ChargeService.createInstallments` |
| **Advanced excess-payment rule (surplus reduces LAST installments first)** | `ChargeService.payInstallment` ✅ already matches the spec |
| JoFotara auto-issue | `FinanceBridgeService.tryIssueForCharge` |
| Read-only quote (registration + tuition − full-pay discount + transport + schedule preview) | `EnrollmentService.quote` |

**Admin UI (reuse components):** existing enrollment wizard (`/enrollment`), fee-config, finance, collections pages; design-system primitives (`Card`, `Table`, `Field`, `Select`, `Badge`, `EntityPicker`, `EmptyState`, etc.).

---

## 2. Existing Modules To Reuse (do NOT rebuild)

- **Models:** `Student`, `Parent`, `ParentStudent`, `Section`, `Grade`, `AcademicYear` (has `startDate`/`endDate`), `Semester`, `Campus`, `Charge`, `Transaction`, `FeeAdjustment`, `PaymentAllocation`, `Refund`, `AuditLog`, `GradeFeeSchedule`, `TransportFare`, `DiscountRule`, `BillingPolicy`, EInvoice\*.
- **Services:** `ChargeService` (esp. `createInstallments`, `payInstallment` — the advanced excess logic is **done**), `LedgerService`, `TransactionService`, `BillingRepository.chargeBalances`, `FeeConfigRepository`, `EnrollmentService.quote`, `StudentService`, `ParentService`, `FinanceBridgeService`.
- **Cross-cutting:** `TenantRepository.run` + RLS, `writeAudit`, `@RequirePermissions`, fils-rounding helpers, EntityPicker/pickers.

---

## 3. Gap Analysis (spec vs. current)

| # | Spec requirement | Today | Gap |
|---|---|---|---|
| G1 | Fee catalog: Books, Uniform, Insurance, Activity, Technology, Exam, Laboratory + school-defined; each fixed / grade-specific / year-specific, mandatory/optional, **discountable/non-discountable** | Only `registrationFee` + `tuitionFee` on `GradeFeeSchedule` | **New** `FeeItem` catalog + per-grade/year amounts + flags |
| G2 | Quotation persisted (saved before student exists) | Quote is ephemeral, in-memory, student-bound by UI | **New** `EnrollmentQuote` + `EnrollmentQuoteItem` (nullable student) |
| G3 | "Student NOT created until parent agrees" + atomic **COMMIT** creating Student, Parent, link, Enrollment, Ledger, Charges, Installments, Transport subscription, Audit, Receipt | UI requires an existing student; charges created via separate non-atomic calls | **New** `RegistrationCommitService` (single `withTenant` tx) |
| G4 | Per-year **Enrollment** record; **Re-enrollment** reuses Student/Parent | No `Enrollment` model (enrollment is implicit via `Student.sectionId` + charges) | **New** `Enrollment` model + `ReEnrollmentService` |
| G5 | Registrar **overrides** any fee (fixed/%/value), installment count/values/due dates, custom schedules | Not supported | **New** `FeeOverrideService` + override fields on quote/commit |
| G6 | **Mandatory modification tracking** (original/new/diff/reason/by/at; `FEE_MODIFIED=TRUE`) | Not supported | **New** `FeeModification` model |
| G7 | **Student financial flag/badge** ("Fee Modified" / "Custom Financial Arrangement"), permanent, shown in profile/finance/ledger/enrollment/reports | Not supported | **New** `StudentFinancialProfile` (or extend `StudentBillingProfile`) + badge UI |
| G8 | Optional **finance approval** workflow gating activation/billing/invoice | Not supported | **New** `FeeModificationApproval` + `BillingPolicy.requireFinanceApprovalForFeeChanges` + `PENDING_APPROVAL` gate |
| G9 | **Custom financial arrangements** | Not supported | **New** `FinancialArrangement` model |
| G10 | Transport **subscription** persisted per enrollment | Only a charge description; bus route/stop assignment is a separate feature-flagged module | Field on `Enrollment` (direction) + reuse `TransportFare` pricing |
| G11 | Discount engine wired into quote: early-registration, sibling, employee, scholarship, custom | `DiscountRule` exists but quote only applies full-payment | **New** `DiscountService` composing `DiscountRule` → `FeeAdjustment` |
| G12 | Services: Quote/Discount/Installment/Enrollment/ReEnrollment/FeeOverride/FinancialApproval/TransportPricing/RegistrationCommit | Partial (`quote`, installment logic in `ChargeService`) | Extract + add services (thin orchestration over existing logic) |
| G13 | New permissions for fee override / approval | Only `finance:manage`/`finance:read` | **New** `fee:override`, `finance:approve` |
| G14 | 12 wizard screens (new + returning, quotation, payment planning, installment builder, student/parent info, review, commit, approval, arrangement) | One single-page wizard (existing student) | Extend admin UI (existing DS components only) |
| G15 | Reports: registrations, re-enrollments, fee mods, arrangements, discounts, installments, outstanding, registrar activity, approvals + filters | Generic reporting module exists | Add report queries/exports |

**Key reuse win:** the trickiest requirement — *"parent pays more than the first installment → apply excess to the LAST installments backward, never increase earlier ones"* — is **already implemented and tested** in `ChargeService.payInstallment`. We reuse it verbatim.

---

## 4. Proposed Database Changes (additive, non-destructive)

**New enums:** `FeeItemKind` (REGISTRATION/TUITION/BOOKS/UNIFORM/INSURANCE/ACTIVITY/TECHNOLOGY/EXAM/LABORATORY/TRANSPORT/CUSTOM), `EnrollmentStatus` (QUOTED/PENDING_APPROVAL/COMMITTED/ACTIVE/CANCELLED), `QuotePaymentMode` (FULL/INSTALLMENTS), `ApprovalStatus` (PENDING/APPROVED/REJECTED).

**New models (all `tenantId` + standard RLS policy + audited):**
1. `FeeItem` — catalog (kind, name En/Ar, default mandatory/discountable). 
2. `GradeFeeItem` — per grade + academic year (+ optional campus/semester) amount, effective-dated, mandatory/discountable overrides. *(Reuses the `GradeFeeSchedule` effective-dating convention.)*
3. `EnrollmentQuote` — academicYearId, gradeId, transportDirection, paymentMode, installments, totals, **nullable** studentId/parent snapshot (created before commit).
4. `EnrollmentQuoteItem` — line per fee (feeItemKind, amount, discountable, discountAmount, **overridden**, originalAmount).
5. `Enrollment` — studentId, academicYearId, gradeId, sectionId?, transportDirection, status, quoteId, `feeModified` flag. Unique `(tenantId, studentId, academicYearId)`.
6. `EnrollmentDiscount` — applied discount snapshot (links `DiscountRule` → resulting `FeeAdjustment`).
7. `EnrollmentPaymentPlan` / `EnrollmentInstallment` — *thin*: plan metadata pointing at the existing `Charge.installmentPlanId` group (avoid duplicating the ledger).
8. `RegistrationCommitment` — idempotency key, committer, committedAt, receipt ref, snapshot.
9. `FeeModification` — entity ref, field, originalValue, newValue, difference, reason, modifiedById, modifiedAt.
10. `FeeModificationApproval` — modification ref, status, approverId, decidedAt, note.
11. `FinancialArrangement` — student/enrollment ref, description, custom schedule JSON, createdBy.
12. `StudentFinancialProfile` — studentId unique, `feeModified` bool, `customArrangement` bool, lastModifiedAt. *(Or extend existing `StudentBillingProfile` — decision needed, see §9.)*

**Extend existing (nullable columns only):**
- `BillingPolicy.requireFinanceApprovalForFeeChanges Boolean @default(false)`, optional `earlyRegistrationDiscountPct`.
- Keep `GradeFeeSchedule` for back-compat; treat registration/tuition as canonical `FeeItem`s seeded from it (no data loss).

No column drops, no type changes, no back-fill that can fail → **safe forward-only migrations**.

---

## 5. Backend Changes (NestJS, under `apps/api/src/finance/`)

New/extended providers (thin orchestration over existing repos):
- `QuoteService` — extend `EnrollmentService.quote` to assemble **all** `FeeItem`s, per-item discountable flags, discount-eligible vs non-eligible totals; persist `EnrollmentQuote`.
- `TransportPricingService` — wrap `TransportFare` lookup.
- `DiscountService` — evaluate `DiscountRule`s (full-pay/early/sibling/employee/scholarship/custom) → produce `FeeAdjustment`s.
- `InstallmentService` — extract/reuse `ChargeService.createInstallments` + `payInstallment`; add academic-year date-bounding.
- `FeeOverrideService` — apply registrar overrides, emit `FeeModification` rows, set `feeModified`.
- `FinancialApprovalService` — create/approve/reject `FeeModificationApproval`; gate activation.
- `RegistrationCommitService` — **single `withTenant` transaction**: create Student→Parent→ParentStudent→Enrollment→Charges→installments→`FinancialArrangement?`→`StudentFinancialProfile`→audit→`RegistrationCommitment`; JoFotara issue best-effort post-commit (existing bridge). Idempotency-Key header.
- `ReEnrollmentService` — load existing student/parent/prior enrollment; create new `Enrollment` + ledger only.

All gated by existing/new permissions; all writes audited via `writeAudit`.

---

## 6. API Changes (new endpoints, versioned `/v1`)

- `POST /enrollment/quote` (extend, persist) · `GET /enrollment/quotes/:id`
- `POST /enrollment/commit` (atomic; Idempotency-Key) — Scenario A
- `POST /enrollment/re-enroll` — Scenario B
- `GET /enrollment/student-search` (reuse student search)
- `POST /enrollment/:id/override` · `POST /enrollment/:id/installments/recalc`
- `GET /fee-items`, `POST/PATCH /fee-items`, `PUT /fee-config/grade-fee-items` (catalog admin)
- `POST /fee-modifications/:id/approve|reject`, `GET /fee-modifications?status=PENDING`
- `POST /financial-arrangements`
- Reports: `GET /reports/registrations`, `/re-enrollments`, `/fee-modifications`, `/financial-arrangements`, `/discounts`, `/installment-plans`, `/outstanding`, `/registrar-activity`, `/approvals` (filters: year/campus/grade/registrar/financeOfficer/dateRange).

---

## 7. Frontend Changes (`apps/admin`, existing DS components only)

Multi-step **Registration Wizard** under `/(app)/admissions` (and refactor existing `/enrollment`):
1. Mode (New / Returning) → 2. Student search (returning) → 3. Year/Grade/Transport →
4. **Quotation screen** (fee table w/ Discountable column, Discount-eligible / Non-eligible / Grand total) →
5. **Payment planning** (Full vs Installments) → 6. **Installment builder** (schedule preview, excess handling) →
7. Student info → 8. Parent info → 9. **Review** → 10. **Commit** →
plus **Approval inbox** screen and **Financial Arrangement** screen.
- Reuse `Card/Table/Field/Select/Badge/EntityPicker/EmptyState`; i18n keys in `@school/i18n` (En/Ar, RTL-safe).
- **"Fee Modified" / "Custom Financial Arrangement" badge** component shown on Student Profile, Finance Card, Billing Ledger, Enrollment record, Reports.

---

## 8. Migration Strategy

1. One additive Prisma migration per logical group (catalog → enrollment → modifications/approvals → arrangements), each appending the standard RLS `DO $$ … tenant_isolation … $$` block for new tables.
2. Seed canonical `FeeItem`s (Registration, Tuition, Transport) and map existing `GradeFeeSchedule`/`TransportFare` values into `GradeFeeItem` — read-only back-compat; old endpoints keep working.
3. Add new permissions to catalog + `role-permissions` seed (Registrar/FinanceOfficer/SchoolAdmin) + Prisma seed for permission rows.
4. `prisma generate` + tenant-DB migration runner (`scripts/migrate-tenants.cjs`) for siloed tenants.
5. Ship behind a `registration_v2` feature flag (existing `FeatureFlag`) so the new wizard rolls out per tenant without disturbing the current `/enrollment` page.

---

## 9. Risk Assessment & Open Decisions

**Risks (and mitigations):**
- *Atomicity of the multi-table commit* → single `withTenant` tx; JoFotara issuance stays best-effort **after** commit (existing pattern). Add **Idempotency-Key** to prevent double student creation on retry.
- *Decimal/fils rounding drift* → reuse the existing fils-based split (`toFils`, last absorbs remainder); no new rounding logic.
- *RLS on new tables* → every new table gets `tenantId` + the standard policy; verified by existing e2e harness pattern (`*.e2e-spec.ts`).
- *Approval gate bypass* → activation/invoice issuance checks `requireFinanceApprovalForFeeChanges` + `FeeModificationApproval.status` server-side, not just UI.
- *Back-compat* → additive only; existing finance/JoFotara/ledger untouched; old enrollment page remains until the flag flips.
- *Scope size* → recommend phased delivery (below) rather than one mega-PR.

**Decisions I need from you before coding:**
1. **`StudentFinancialProfile`**: create new model, or **extend the existing `StudentBillingProfile`** (already 1-per-student) with `feeModified`/`customArrangement`? *(Recommend: extend — avoids a parallel per-student table.)*
2. **`Enrollment` model**: introduce the new per-year record (recommended for re-enrollment), or keep enrollment implicit and tag by academic year on charges? *(Recommend: new `Enrollment` model.)*
3. **Delivery shape**: one large PR, or **phased PRs** — (A) fee-item catalog + extended quote, (B) atomic commit + Enrollment + re-enroll, (C) overrides + modification tracking + badge, (D) approval workflow, (E) reports? *(Recommend: phased.)*
4. **Replace vs. add** the current `/enrollment` page: keep it and add `/admissions`, or replace in place behind the feature flag?

---

### Recommended phasing
- **Phase A** — `FeeItem` catalog + `GradeFeeItem` + extended persisted quotation (all fee types, discountable totals). Lowest risk, immediately visible.
- **Phase B** — `Enrollment` model + `RegistrationCommitService` (atomic Scenario A) + `ReEnrollmentService` (Scenario B).
- **Phase C** — `FeeOverrideService` + `FeeModification` + financial badge.
- **Phase D** — approval workflow (`FeeModificationApproval`, policy gate).
- **Phase E** — `FinancialArrangement` + reporting suite.

> **No code will be written until you approve the approach and the four decisions in §9.**
