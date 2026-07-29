# Family-Based Billing Refactor — Architecture Analysis & Implementation Plan

**Status:** Analysis — awaiting approval before implementation
**Scope:** Move the finance workflow from student-centric to family-centric billing while preserving student-level accounting, the ledger, JoFotara, audit logs, reporting, and the parent portal.
**Guiding rule:** This is an *architectural evolution* built on top of the existing AR domain — not a rewrite.

---

## 0. Executive summary

The codebase already carries most of the building blocks needed for family billing:

- The **Registration Agreement is already family-first**: `RegistrationAgreementService.generate()` builds one agreement per guardian + academic year, covering *all* the guardian's committed students, and merges their installments by due date into a single family schedule (`combineSchedules`). It is idempotent and versioned.
- The **allocation engine already anticipated cross-student allocation**: `allocation-policy.ts` declares `CROSS_STUDENT` as a planned seam alongside the shipped `FIFO_BY_DUE_DATE` policy. `FifoByDueDatePolicy.allocate()` is pure — it takes a list of installments and an amount; it does not care whose installments they are.
- **Charges, discounts, scholarships, refunds, credits, JoFotara, collections and reports are all student-scoped** and must stay that way.

What is missing is the **persistent family layer** that (a) owns the payment plan, (b) guarantees exactly *N* family installments (today N is an emergent property of merging aligned per-student schedules — it can drift if children's due dates differ), and (c) lets a single payment settle multiple children.

The recommended approach introduces a thin **Family Financial Account + Family Payment Plan** grouping layer over the *unchanged* student ledger, and implements the already-declared `CROSS_STUDENT` allocation seam. Every new column/table is additive and nullable; **no historical data is migrated**; existing single-student flows keep working unchanged.

---

## 1. Current architecture

### 1.1 The AR ledger (student-owned — keep as-is)

```
Parent ──< ParentStudent >── Student ──1:1── StudentFinancialAccount ──< Charge ──< Installment
                                                     │                      │            │
                                                     │                      └─ PaymentPlan (0..1 ACTIVE per charge)
                                                     ├──< Payment ──< PaymentAllocation ──> Installment
                                                     ├──< FeeAdjustment (discount/scholarship/waiver/write-off/credit-memo)
                                                     ├──< Credit ──< RefundConsumption
                                                     └──< Refund
                                                     Payer (billing party, usually the primary guardian)
```

Key facts established from the code:

| Concern | Where | Behaviour |
|---|---|---|
| Account ownership | `StudentFinancialAccount` (`studentId @unique`) | Exactly one AR account per student. |
| Payer | `Payer` (`parentId?`) | Billing party; `AccountRepository.ensurePayerForStudentTx` links the primary guardian. Already parent-linked. |
| Charge | `Charge` (`accountId`, `studentId`) | A single obligation, never split. `ADR-001`: paid via 0..1 active `PaymentPlan`. |
| Plan | `PaymentPlan` (`chargeId`) | One plan **per charge** → today the plan is effectively per-student. |
| Installment | `Installment` (`chargeId`, `planId?`) | Schedule line; Σ installment == charge net. |
| Payment | `Payment` (`accountId`, `studentId`, `payerId?`) | **Student-scoped** — both `accountId` and `studentId` are NOT NULL. |
| Allocation | `PaymentAllocation` (`paymentId`, `installmentId`) | Applies money to a **specific installment**. Never targets a charge. |
| Auto-allocation | `LedgerService.allocateOnVerify` | On verify, FIFO across `openInstallments(payment.studentId)` — **single student**; residue → overpayment `Credit`. |
| Allocation policy | `FifoByDueDatePolicy` | Pure function `(amount, installments[]) → lines[]`. `CROSS_STUDENT` declared but unimplemented. |
| Summary | `LedgerRepository.accountSummary(studentId)` | All figures aggregate `WHERE studentId = …`. |

### 1.2 Admissions / registration (student-centric — the main change)

- `AdmissionsPage` (admin) is a **single-student wizard**: enrollment → transport → quote → student → guardian → review.
- `QuoteService.compute()` produces a **per-student** `ComputedQuote` (fee lines + a preview schedule on the grand total).
- `AdmissionsRepository.commit()` atomically creates **one** Student + Parent + link + Enrollment + Charges + PaymentPlan + Installments, per single quote. `createEnrollmentCharges` carves the registration fee into its own one-off charge, then splits the remainder into N monthly installments **for that one student**.
- `RegistrationCommitment` gives idempotency per commit.

### 1.3 Agreement generation (already family-aware — display only)

- `RegistrationAgreementService` builds **one agreement per guardian + year** across all the guardian's committed enrollments, merges their per-student installments by due date into one family schedule, fingerprints the content, and supersedes the prior version when a new child enrolls. The archived PDF + `feeBreakdown`/`installmentSchedule` JSON snapshots are immutable.
- **Gap:** the family schedule is *derived by merging* independent student plans. If two children have different `firstDueDate`s or a different installment count, the merge yields *more* than N family rows. There is no persisted family plan asserting "this family pays in exactly 9 installments."

### 1.4 Reporting, collections, parent portal

- `FinanceReportsRepository.summaryByDimension` aggregates the `Charge` ledger by academicYear/grade/campus/category via one RLS-scoped SQL statement. **Student/charge-oriented; no family dimension.**
- `CollectionsCase` is 1:1 with `StudentFinancialAccount` (per-student dunning). `StudentBillingProfile` is a per-student projection.
- Parent portal (`parent-portal/dashboard`) is **per-child** (`childDashboard(studentId)`), with a multi-child switcher (`ParentScopeService.children()`). No family-total landing.

---

## 2. Modules affected

| # | Module | Path | Change class |
|---|---|---|---|
| 1 | Prisma schema | `prisma/schema.prisma` | Additive: 2–3 new models + nullable FKs. |
| 2 | Migrations | `prisma/migrations/*` | 1 new additive migration (+RLS). |
| 3 | Account | `finance/account/*` | New family-account resolution + family summary. |
| 4 | Ledger | `finance/ledger/*` | Implement `CROSS_STUDENT` policy; family-scoped `openInstallments`/summary; family credit. |
| 5 | Payments | `finance/payments/*` | Accept a family payment; verify → family auto-allocation. |
| 6 | Admissions | `finance/admissions/*` | Family quote (multi-student) + family commit + family plan. |
| 7 | Charges | `finance/charges/*` | Reuse `InstallmentScheduleService` for the family plan (no change to the generator). |
| 8 | Reports | `finance/reports/*` | Family-total default + student drill-down. |
| 9 | Collections | `finance/collections/*` | Optional family roll-up (can defer). |
| 10 | Statement | `finance/statement/*` | Family statement + student statement. |
| 11 | Documents | `documents/registration-agreement.service.ts` | Generate the family schedule **from the Family Payment Plan** instead of merging. |
| 12 | Parent portal | `parent-portal/dashboard/*` | Family landing + per-child drill-down. |
| 13 | Admin UI | `apps/admin/.../admissions`, `.../finance` | Family admission wizard; family finance dashboard; existing-family wizard. |
| 14 | Contracts / libs | `apps/admin/src/lib/*`, `packages/contracts` | New DTOs/clients (additive). |
| 15 | i18n | `packages/i18n` | New family strings (AR/EN). |

Explicitly **unchanged**: `FeeAdjustment`, `Credit`, `Refund`, `RefundConsumption`, `PaymentAllocation` target (still an installment), JoFotara (`einvoicing/*`, `finance-bridge`), `AuditLog`, `PaymentReceiptCounter`/gapless numbering.

---

## 3. Database impact

**Principle:** additive, nullable, no backfill. New admissions opt into the family layer; every legacy row (family FKs null) behaves exactly as today.

### 3.1 New models

```prisma
/// The financial customer: a guardian/household that owns payment plans and payments.
/// Student AR accounts (charges) remain student-owned and link UP to this.
model FamilyAccount {
  id        String        @id @default(uuid()) @db.Uuid
  tenantId  String        @db.Uuid
  parentId  String?       @db.Uuid   // primary guardian (nullable for edge cases)
  payerId   String?       @db.Uuid   // reuse existing Payer as the billing identity
  currency  String        @default("JOD")
  status    AccountStatus @default(ACTIVE)
  createdAt DateTime      @default(now()) @db.Timestamptz(6)
  updatedAt DateTime      @updatedAt @db.Timestamptz(6)

  tenant   Tenant                    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parent   Parent?                   @relation(fields: [parentId], references: [id], onDelete: SetNull)
  payer    Payer?                    @relation(fields: [payerId], references: [id], onDelete: SetNull)
  accounts StudentFinancialAccount[] // the children's AR accounts
  plans    FamilyPaymentPlan[]
  payments Payment[]
  credits  Credit[]

  @@index([tenantId])
  @@index([tenantId, parentId])
}

/// HOW a family pays over time. Owns the family installment schedule. Per-student PaymentPlans
/// (one per charge) reference this so the child schedules stay aligned to the family cadence.
model FamilyPaymentPlan {
  id             String             @id @default(uuid()) @db.Uuid
  tenantId       String             @db.Uuid
  familyAccountId String            @db.Uuid
  academicYearId String             @db.Uuid
  cadence        PaymentPlanCadence @default(MONTHLY)
  installments   Int
  firstDueDate   DateTime           @db.Date
  status         PaymentPlanStatus  @default(ACTIVE)
  createdById    String?            @db.Uuid
  createdAt      DateTime           @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime           @updatedAt @db.Timestamptz(6)

  tenant         Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  familyAccount  FamilyAccount       @relation(fields: [familyAccountId], references: [id], onDelete: Cascade)
  studentPlans   PaymentPlan[]       // the aligned per-charge plans that make up this family plan

  @@index([tenantId, familyAccountId])
  @@index([tenantId, status])
}
```

### 3.2 Additive columns on existing models (all nullable → backward compatible)

| Model | Column | Purpose |
|---|---|---|
| `StudentFinancialAccount` | `familyAccountId String? @db.Uuid` + relation | Link a child's AR account to its family. |
| `PaymentPlan` | `familyPlanId String? @db.Uuid` + relation | Tie a per-charge plan to the family plan (keeps due dates aligned). |
| `Payment` | `familyAccountId String? @db.Uuid` + relation | Mark a payment as family-owned → triggers cross-student allocation. |
| `Payment` | `studentId String? @db.Uuid` (relax to nullable) | A family payment is not tied to one child. **Existing rows keep their value**; only new family payments leave it null. `accountId` similarly relaxed to nullable, or set to a representative child — see §11 risk. |
| `Credit` | `familyAccountId String? @db.Uuid` (optional) | Where a family over-payment banks. |

> **Decision point (see §11):** relaxing `Payment.studentId`/`accountId` to nullable is the cleanest model but touches a hot table. The safe alternative keeps them NOT NULL and points a family payment at a *representative* child account while `familyAccountId` drives allocation. Recommendation: **relax to nullable** with a DB `CHECK (studentId IS NOT NULL OR familyAccountId IS NOT NULL)`; it is an additive DDL (`ALTER COLUMN DROP NOT NULL`) that cannot fail against existing data.

### 3.3 RLS + grants

All new tables (`FamilyAccount`, `FamilyPaymentPlan`) get the standard `tenant_isolation` policy via the same `DO $$ … FOREACH` block used in `20260703120000_finance_ar_domain`. Grants come from `infra/postgres/app-role.sql` (GRANT ON ALL TABLES), same as every other table.

### 3.4 Migration

One migration `2026xxxx_family_billing` — `CREATE TABLE` ×2, `ALTER TABLE … ADD COLUMN` (nullable) ×N, `ALTER COLUMN … DROP NOT NULL` ×2, FKs, indexes, RLS block. **No `UPDATE`/backfill.** Fully reversible (drop columns/tables).

---

## 4. API impact

| Area | New/changed endpoints (additive; existing ones untouched) |
|---|---|
| Family account | `GET /finance/families/:id` (dashboard totals + children), `GET /finance/families/search?q=` (guardian/father/mother/family/phone/national-id/student). |
| Family admissions | `POST /admissions/family/quote` (multi-student quote), `POST /admissions/family/commit` (atomic multi-student), `GET /admissions/family/:parentId/context` (existing-family wizard data). |
| Family payments | `POST /finance/families/:id/payments` (record once), verify reuses the existing payment-verify path but branches to family allocation when `familyAccountId` is set. |
| Reports | `GET /finance/reports/outstanding?groupBy=family|student`, `GET /finance/reports/collection?groupBy=family|student`. |
| Statement | `GET /finance/families/:id/statement`, existing `GET student statement` kept. |
| Parent portal | `GET /parent/finance/summary` (family), existing `GET child dashboard` kept. |

Existing student-scoped endpoints (`account/:studentId`, `ledger`, `payments`, `statement/:studentId`) remain for backward compatibility and for the per-student drill-down.

---

## 5. UI impact (Munaxa Design System — reuse only)

- **Family Admission wizard** (replaces single-student default for *new* admissions): Step 1 Guardian → Step 2 Add Students (repeatable, `Add Student`) → Step 3 one Family Financial Package → Step 4 Payment Plan (family) → Step 5 one Agreement → Step 6 one Family Installment schedule. Built from existing `Card`, `Table`, `Field`, `Input`, `Select`, `Checkbox`, `Button`, `Badge`, wizard step pattern already in `admissions/page.tsx`. No new components.
- **Family Finance Dashboard** (`finance/dashboard`): search box (multi-key) → select family → KPI row (Total Charges / Paid / Outstanding / Credit / Next Due / Last Payment / Collection Status / Children Count) using existing KPI card pattern; Children section with expandable per-student detail. Default view = family totals.
- **Existing-family wizard**: a `Dialog` with three options (Merge / Keep separate / New plan), option 3 gated by a confirm.
- RTL/LTR + dark/light + AR/EN inherited from the existing components and `packages/i18n`.

---

## 6. Parent portal impact

- New **family finance landing**: Family Outstanding, Next Installment, Total Paid, Payment History, Children — computed from the family summary + Family Payment Plan.
- Clicking a child opens the existing per-child financial detail (charges, payments, discounts, transport, invoices) **without losing** the family summary (keep the family header mounted).
- Reuse `ParentScopeService.children()` for the child list; add a `familySummary()` that aggregates across the guardian's students (sum of `accountSummary` per child + family credit/next-due from the Family Payment Plan).

---

## 7. Reporting impact

- Reports **default to family totals**, drill down to student.
- `summaryByDimension` stays (student/charge ledger is the source of truth). Add a `family` grouping that rolls charges up by the guardian via `ParentStudent`/`FamilyAccount`.
- New report shapes: Outstanding Families / Outstanding Students, Family Statement / Student Statement, Family Collection / Student Collection. All derived from the **same ledger rows** (single source of truth) — no parallel accounting.

---

## 8. Agreement generation impact

- Switch `RegistrationAgreementService` to build the family schedule **from the Family Payment Plan** (authoritative N installments) rather than merging independent student schedules. The per-student fee rows in `feeBreakdown` stay exactly as today.
- **Backward compatibility:** when an enrollment has no `FamilyPaymentPlan` (all legacy admissions), fall back to the current `combineSchedules` merge — so existing agreements regenerate identically.
- Idempotency/fingerprint/supersede logic and the immutable snapshot are preserved.

---

## 9. Ledger impact

- **No change** to the ledger's meaning: charges stay student-owned; allocations still target a single installment; discounts/scholarships/waivers/write-offs/credit-memos/refunds are unchanged.
- **Additions only:**
  - Implement `CrossStudentFifoPolicy` (the declared `CROSS_STUDENT` seam) = the *same* FIFO logic over the union of the family's open installments. `FifoByDueDatePolicy` already accepts an arbitrary installment list, so this is a new caller + a family-scoped `openInstallments`, not a rewrite.
  - `allocateOnVerify` branches: `payment.familyAccountId` set → allocate across the family's open installments (FIFO by due date; aligned schedules make same-due-date child installments settle together); residue → family `Credit`. `familyAccountId` null → today's single-student path, untouched.
  - `accountSummary` gains a family sibling `familySummary(familyAccountId)` = Σ per-student summaries + family credit + next-due from the Family Payment Plan. Per-student summary unchanged.

---

## 10. Migration strategy

1. **Schema/migration** (additive, no backfill) → deploy. System behaves identically (all family FKs null).
2. **Ledger/allocation** (cross-student policy, family summary) behind the `familyAccountId` branch — inert until a family payment exists.
3. **Admissions family commit** writes the family layer for *new* admissions only.
4. **Agreement** reads the family plan when present, else falls back to the merge.
5. **UI** ships the family wizard/dashboard as the new default for new admissions; existing student flows remain reachable.
6. **Existing schools**: *no automatic data migration.* An optional, explicit, per-family "convert to family plan" action can be added later (out of initial scope) that creates a `FamilyAccount` + `FamilyPaymentPlan` from the remaining unpaid installments — never touching paid history.

---

## 11. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Relaxing `Payment.studentId`/`accountId` to nullable | Any code assuming non-null could break; hot table. | Add DB `CHECK (studentId IS NOT NULL OR familyAccountId IS NOT NULL)`. Audit all readers of `payment.studentId` (receipts, JoFotara bridge, statements) and guard family payments. **Alternative:** keep NOT NULL, point at a representative child. Decide before coding — **AskUserQuestion**. |
| Cross-student allocation ordering | A family payment could settle child B before child A "unfairly". | FIFO by due date is deterministic and matches the merged-schedule intuition; document it; the manual-allocation endpoint still allows targeting a specific installment. |
| Over-payment credit ownership | Family residue has no single student. | Bank to `FamilyAccount` (new `Credit.familyAccountId`); refunds consume family credit FIFO. Keep student credit path unchanged. |
| JoFotara / receipts on family payments | e-invoice bridge keys off charge/student. | Invoices are still per-charge (student-owned). A family payment's allocations produce per-installment/per-charge settlement rows → JoFotara continues to see student charges. Verify `finance-bridge` on the family path in the /verify skill. |
| Agreement regeneration drift | Changing the schedule source could alter existing agreements. | Fallback to `combineSchedules` when no family plan; fingerprint guards against needless supersede; snapshot immutability preserved. Covered by `registration-agreement.service.spec.ts`. |
| Collections 1:1 with student account | Family roll-up not modelled. | Keep per-student collections; add a read-only family roll-up view. Defer deeper changes. |
| RLS / multi-tenant | New tables must enforce tenant isolation. | Reuse the standard `tenant_isolation` policy block + `app-role.sql` grants. |

---

## 12. Rollback strategy

- **Code:** every family path is gated on `familyAccountId`/`familyPlanId` being non-null. Reverting the admissions/UI commits stops new family rows being created; existing single-student flows are unaffected because they never touched the family branch.
- **Data:** the migration is `CREATE TABLE`/`ADD COLUMN (nullable)`/`DROP NOT NULL` only. A down migration drops the two tables and the nullable columns and re-asserts NOT NULL (safe only if no family payment rows exist; otherwise leave columns in place — they are inert). No historical accounting is ever rewritten, so rollback loses only not-yet-relied-upon family metadata.
- **Feature flag:** optionally gate the family wizard behind an existing `FeatureFlag` so a school can be flipped back to the single-student wizard instantly without a deploy.

---

## 13. Recommended implementation order (safest first)

1. **Schema + migration** (additive tables/columns + RLS). Generate Prisma client. `typecheck`. — *zero behaviour change.*
2. **Account layer**: `FamilyAccount` resolution (find-or-create from a guardian, reusing `Payer`), link student accounts. Unit-test.
3. **Ledger**: `CrossStudentFifoPolicy` + family-scoped `openInstallments`/`familySummary` + family credit. Unit-test against the existing allocation specs pattern.
4. **Payments**: record a family payment; `allocateOnVerify` family branch. Reuse verify + gapless receipt. Test verify→allocate→credit end-to-end (/verify skill).
5. **Admissions**: family quote (loop `QuoteService` per child, one combined package) + atomic family commit (Students + one `FamilyAccount` + one `FamilyPaymentPlan` + aligned per-charge plans) + idempotency. Test with 2–3 children.
6. **Agreement**: read the Family Payment Plan for the schedule; keep the merge fallback. Verify the existing agreement specs still pass.
7. **Existing-family wizard** (Merge / Keep separate / New plan) — recalculate only remaining unpaid installments; never touch paid history.
8. **Reports + statement**: family default, student drill-down.
9. **Parent portal**: family landing + child drill-down.
10. **Admin UI**: family admission wizard + family finance dashboard, Design-System components only, RTL/LTR + dark/light + AR/EN.
11. Full regression: ledger, JoFotara, audit, reporting, parent portal, and the existing single-student admission path.

At every step: additive-only, gated on the family FKs, and re-verified that the untouched student paths still work.

---

**Awaiting approval of this analysis before any implementation begins.**
