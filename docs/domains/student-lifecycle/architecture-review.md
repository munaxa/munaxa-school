# Student Lifecycle, Admission & Academic-Year Architecture Review

> **Status: APPROVED FOR IMPLEMENTATION (Rev. 3).** Rev. 2 approved with the six clarifications below;
> implementation proceeds along the §17 roadmap, additive-first and backward-compatible.
> **Rev. 2** folded in the 13 architecture decisions; **Rev. 3** adds the final implementation
> constraints. Where a decision reversed a Rev. 1 recommendation it is called out inline (▲ CHANGED).
> **Scope:** Student identity, Admission workflow, Enrollment participation lifecycle, Academic Year
> lifecycle, one shared Enrollment-creation pipeline, Year-End Processing, Withdrawal / Graduation /
> Re-enrollment, internal Student Number. Built **on top of** the existing Finance ledger, Financial
> Account (`Payer`), Enrollment, Admissions and Fee-Config modules. **No existing ledger is
> redesigned. No automatic data migration.**
> **House conventions reused:** `TenantRepository.run()` + Postgres RLS, `writeAudit(tx, …)` in the
> same transaction, `@RequirePermissions`, partial-unique-index soft-delete pattern, effective-dated
> fee config, gapless per-tenant counters (`PaymentReceiptCounter`/`EInvoiceCounter`),
> control-account/subsidiary-ledger finance model.

---

## THE GOVERNING PRINCIPLE (Decision 13 — the most important rule)

> **The `Student` entity is a permanent identity record. Every piece of information that can change
> between Academic Years belongs to `Enrollment` (or another year-scoped entity). Mutable academic
> information is NEVER duplicated on `Student`.**

This rule governs this refactor **and every future Munaxa module.** Any field that varies year to
year — grade, section, classroom, enrollment status, academic year, transport, fee plan, advisor,
timetable — is year-scoped by construction. When designing anything new, the first question is
"does this change between years?"; if yes, it does not go on `Student`.

---

## Rev. 3 — final implementation constraints (ratified)

1. **Academic Year migration — no silent merges, abort on conflict.** `campusId` is **not** kept
   permanently on `AcademicYear`; it stays only as a transitional shim. The migration must:
   (1) validate every tenant, (2) detect duplicate Academic Years (same School + same year Name),
   (3) generate a **conflict report**, (4) **abort** for tenants with conflicts, (5) require an
   administrator to resolve before continuing. No silent merges, no automatic consolidation, no
   assumptions — **data integrity over convenience** (§3, §6, §6a).
2. **Migration principles for the whole roadmap:** additive first · backward compatible · fully
   reversible until the final cleanup phase · zero data loss · fully audited. Legacy columns remain
   through the transition and are removed only after the new architecture is validated in production.
3. **Student "current status" is a derived projection**, computed from the latest active Enrollment,
   never stored as authoritative data on `Student` (§2).
4. **Student Number is configurable per school:** optional Prefix, Starting number, Padding length,
   Reset policy (**never reset by default**) — e.g. `S-000001`, `2026-000001`, `STD000001`. Default is
   an ever-increasing sequence that never resets (§2a).
5. **Year-End Processing creates NOTHING until Final Confirm** — no Enrollment, no Charges, no Payment
   Plans, no finance records. Before confirmation everything exists only as a temporary preview
   (§5b).
6. **Promotion never modifies previous years.** It always creates a *new* Enrollment; history is
   immutable (§5c, §12).

---

## 0. Executive position

**This is mostly completion and correction, not a new system.** Munaxa already shipped the correct
spine:

| Business rule | Already in the codebase |
|---|---|
| One `Student` per person; identity by National ID / MoE number | `Student.nationalId` + `Student.moeStudentNumber`, uniqueness by **partial unique indexes** (`WHERE deletedAt IS NULL`) — soft-delete-safe. |
| One student → many enrollments; each enrollment ∈ one academic year | `Enrollment` with `@@unique([tenantId, studentId, academicYearId])`. |
| Academic info on Enrollment; finance on the Financial Account | `Enrollment` + `Payer` (Financial Account) → `StudentFinancialAccount` sub-ledger. `Charge` already carries `enrollmentId` + `academicYearId`. |
| Re-enrollment reuses the student, never recreates | Admissions DTO already accepts `existingStudentId`; `RegistrationCommitment` gives idempotent commit. |
| Ledger is single source of truth; balances span years | `Payer` control account over per-student sub-ledgers; `Charge.academicYearId` dimensions the ledger by year. |

The work is: **(a) build four things genuinely missing** — a School-scoped Academic-Year status
machine, a *participation* `EnrollmentStatus` distinct from a *workflow* `AdmissionStatus`, the
Year-End Processing wizard (preview → confirm), and a single identity-lookup admission entry;
**(b) enforce the governing principle** by moving all academic placement off `Student`; and
**(c) add the internal Student Number.**

The 13 decisions are ratified in §16. **No code until this Rev. 2 is approved.**

---

## 1. Domain review

Canonical nouns and where each concept lives:

- **Student = a person, for life.** Permanent identity **only**: names (EN/AR + father/third),
  National ID, MoE number, **internal Student Number** (new, §2a), DOB, gender, `userId`, `qrCode`,
  guardianship links. Nothing time-varying about schooling. Never archived, never deleted for
  history (Decisions 4, 7, 13).
- **Admission = the workflow that decides whether a person joins a given year.** Owns
  `AdmissionStatus` (Draft → Quoted → Accepted → Registered → Cancelled). A workflow artifact, not a
  participation record (Decision 2).
- **Enrollment = one student's participation in one Academic Year.** Owns `EnrollmentStatus` (Active
  → Completed → Promoted/Repeated/Graduated/Withdrawn → Archived) **and** all year-specific
  placement: campus, grade, section, classroom, admission/withdrawal/graduation dates, reason,
  transport intent, fee references (Decisions 2, 4).
- **Academic Year = a School-scoped calendar/administrative entity** (Decision 1) with Start/End and
  an explicit `Upcoming/Active/Closed` status (Decision 8) that gates admissions, attendance,
  timetables, academics, finance generation and reporting. Exactly one `Active` per School.
- **Financial Account (`Payer`) = the customer that pays** — parent, grandparent, employer, sponsor,
  charity, embassy, ministry (Decision 5). Control account over per-student `StudentFinancialAccount`
  sub-ledgers. Never recreated on withdrawal; survives any child leaving.
- **Ledger = Charge/PaymentPlan/Installment/Payment/Allocation/Credit/Refund** — immutable history,
  the single source of truth, reused untouched (Decision 11).

Direction of data: identity rolls sideways (Student ↔ Guardian ↔ Financial Account), academic facts
roll down to the Enrollment, money rolls up the ledger.

---

## 2. Student lifecycle review (Decisions 4, 7, 13)

**Target model: `Student` holds NO mutable academic column.** The following move off `Student`
entirely and become year-scoped on `Enrollment` (or derived): `sectionId`, `status` (academic
meaning), `enrollmentDate`, `areaId`, `transportRequested`.

**"Is this person currently enrolled / withdrawn / graduated?" is a DERIVED projection**, computed
from the student's Enrollments — **not** a stored academic column on `Student` (Decision 4 explicitly
forbids storing Enrollment Status on Student). It is exposed via a read model / API projection
(`currentEnrollment`, `currentEnrollmentStatus`) built by joining to the enrollment in the Active
year.

**Graduation (Decision 7):** closes the *Enrollment* only (`EnrollmentStatus = Graduated`). The
`Student` is **never** archived or removed. Graduated people remain permanent records for transcript
requests, certificate verification and historical reporting. There is no "graduated student" — there
is a person whose 2027-28 enrollment is Graduated.

**Transition for the existing `Student.status` / `Student.sectionId` (they are load-bearing across
attendance/finance/lists):** the columns are **deprecated compatibility shims**, not part of the
target model. During migration they are written *only* by the single Enrollment-lifecycle writer
(never by a screen) as a read-through cache of the current enrollment, and readers are migrated to
the derived projection incrementally. The final roadmap step **drops** them, leaving `Student`
identity-only. This honours Decision 13 while not breaking every reader on day one.

---

## 2a. Student Number (Decision 6 — new)

Add an **internal Student Number**: a school-generated, human-readable identifier, **separate from
National ID and MoE number**, and a **permanent identity attribute** (it does not change between
years, so it belongs on `Student` — consistent with Decision 13).

- **Field:** `Student.studentNumber String` — `@@unique([tenantId, studentNumber])`.
- **Generation:** auto-assigned at student creation by a **gapless per-tenant/per-school counter**,
  reusing the existing `PaymentReceiptCounter`/`EInvoiceCounter` row-locked pattern
  (`StudentNumberCounter`). **Configurable per school** (Rev. 3 Decision 4): optional **Prefix**,
  **Starting number**, **Padding length**, **Reset policy** (default **never reset**). Examples:
  `S-000001`, `2026-000001`, `STD000001`. Default is an ever-increasing sequence that never resets.
  Never user-entered, never reassigned.
- **Used on:** Report Cards, QR Cards, Attendance Sheets, Library Cards, Certificates.
- **Distinct from `qrCode`** (already on `Student`, an opaque scan token) and from `StudentCard`
  (the physical-card record) — the Student Number is the readable business identifier those surfaces
  print.
- **Not an identity-lookup key for admission** — admission identity resolution stays National ID
  (primary) / MoE number (fallback), exact match only (§9).

---

## 3. Academic Year architecture review (Decisions 1, 8)

▲ **CHANGED from Rev. 1** (which recommended per-campus). **Academic Year is now School-scoped.**

**Today:** `AcademicYear` is scoped **per campus** (`@@unique([tenantId, campusId, name])`) with only
an `isCurrent` boolean.

**Target:**

1. **Re-scope to the School.** `AcademicYear` belongs to `School`, not `Campus`
   (`@@unique([tenantId, schoolId, name])`). **Campuses participate** in the School's Academic Year;
   they do not own their own. Different concurrent Academic Years are a **multi-school-group** concern
   for the future, **not** multiple campuses within one school (Decision 1).
2. **Explicit lifecycle** `enum AcademicYearStatus { UPCOMING ACTIVE CLOSED }` (Decision 8),
   replacing/superseding `isCurrent` (`isCurrent == status == ACTIVE`).
3. **Exactly one `ACTIVE` per School**, enforced by a partial unique index
   (`… WHERE status = 'ACTIVE'`), mirroring the "one ACTIVE PaymentPlan per charge" pattern.
4. **Never deletable** (Decision 8) — enforced by a guard; lifecycle only ever moves
   `UPCOMING → ACTIVE → CLOSED`.
5. **Closure is administrative only** — flips to `CLOSED`, **locks academic editing** for that year
   (attendance/grades/timetables read-only via a status-keyed guard); **never** mutates Student or
   Enrollment; **finance stays open** and prior balances remain collectible (§8, §12).

**Migration note (Rev. 3 — abort on conflict, no silent merge):** the re-scope from campus to school
is the one structurally significant change, split into safe phases:

- **Phase A (additive, this step):** add nullable `schoolId` (backfilled from `campus.schoolId`) and
  `status`; **keep `campusId`** as a transition shim. No unique constraint change yet, so no
  existing row can conflict. Single-`ACTIVE`-per-school is enforced at the application layer now.
- **Validation gate (§6a):** a per-tenant validator detects duplicate Academic Years (same School +
  same year Name) and schools with more than one active year, emits a **conflict report**, and
  **aborts** the school-scoped cleanup for any tenant with conflicts. An administrator must resolve
  conflicts first. **No silent merge, no auto-consolidation.**
- **Phase B (cleanup, later step, only after validation passes):** swap `@@unique[tenantId, campusId,
  name]` → `@@unique[tenantId, schoolId, name]`, add the single-`ACTIVE`-per-school partial index,
  and drop `campusId`.

---

## 4. Admission Status vs. Enrollment Status — two distinct lifecycles (Decision 2)

▲ **CHANGED from Rev. 1** (which recommended one merged status machine). **They stay separate**, on
**separate entities**, because they are different business concepts and must be distinguishable in
reporting and logic.

### 4a. `AdmissionStatus` — the admission workflow (on the admission artifact)

```
DRAFT ──▶ QUOTED ──▶ ACCEPTED ──▶ REGISTERED
   └──────────┴───────────┴───▶ CANCELLED   (abandoned before registration)
```

Values: `Draft · Quoted · Accepted · Registered · Cancelled`.

**Implementation note (Step 2, as built):** the admission workflow operates on the **`Enrollment`
row** in the current codebase — the finance-approval "held" state and the approve/reject decision are
applied to the enrollment, not to a separate record. So `admissionStatus` is a **column on
`Enrollment`** (its own concept, alongside the participation `status` — two distinct columns satisfy
Decision 2), rather than a separate entity. `Draft`/`Quoted` remain pre-enrollment, quote-level
states (a saved `EnrollmentQuote` with no committed enrollment yet). `Accepted` = held pending
finance approval; `Registered` = admission finalised (the gate for agreements, documents and the
participation `status = ACTIVE`); `Cancelled` = admission abandoned. This is a small, deliberate
refinement of Rev. 1's "separate entity" phrasing — flag if you'd prefer the workflow on the quote
instead.

### 4b. `EnrollmentStatus` — participation in an Academic Year (on `Enrollment`)

```
ACTIVE ──▶ COMPLETED ──▶ PROMOTED | REPEATED
   ├──────────────────▶ GRADUATED
   └──────────────────▶ WITHDRAWN
                        (terminal) ──▶ ARCHIVED   (year Closed)
```

Values: `Active · Completed · Promoted · Repeated · Withdrawn · Graduated · Archived`. An `Enrollment`
row only exists from `REGISTERED` onward, so it never needs the workflow states.
`Promoted`/`Repeated` are stamped on the **outgoing** enrollment when the **next** enrollment is
created, giving clean history ("2025-26 Grade 4 Promoted → 2026-27 Grade 5 Active").

### 4c. Migration of the existing conflated enum

Current `EnrollmentStatus { QUOTED PENDING_APPROVAL COMMITTED ACTIVE CANCELLED }` is split:

| Current value | Goes to | New value |
|---|---|---|
| `QUOTED`, `PENDING_APPROVAL` | `AdmissionStatus` (on the quote/admission artifact) | `Quoted`, (Accepted-pending) |
| `CANCELLED` (pre-registration) | `AdmissionStatus` | `Cancelled` |
| `COMMITTED`, `ACTIVE` | `EnrollmentStatus` (on `Enrollment`) | `Active` |

Reporting and business logic query the **admission** artifact for funnel/workflow metrics and the
**Enrollment** for participation metrics — never one column for both.

---

## 5. Single Enrollment-creation pipeline + Year-End Processing (Decisions 3, 9, 10)

### 5a. One shared pipeline (Decision 3 — approved)

**Every path that creates a new `Enrollment` — Admission, Re-enrollment, Promotion, Repeat — goes
through one backend service** (extend the existing `RegistrationCommitService`). **No separate
implementations, ever.** It: resolves-or-creates the Financial Account, creates the Enrollment with
its year-scoped placement, generates Charges/Plan/Schedule via the existing fee engine, writes audit,
and is idempotent per commit (`RegistrationCommitment.idempotencyKey`). The existing family
MERGE/SEPARATE/NEW_PLAN wizard folds in as a **mode/parameter**, not a second endpoint.

### 5b. Year-End Processing wizard — preview then commit (Decision 9)

▲ **REFINED from Rev. 1.** The wizard **must not create any Enrollment until the final confirmation**
and is **fully reversible until that commit.**

- **New models:** `YearEndProcess` (per School+source year: status, counts, actor, timestamps) and
  `YearEndDecision` (per student: planned action `PROMOTE | REPEAT | GRADUATE | WITHDRAW |
  DECIDE_LATER`, assigned grade/section/classroom, review flags, and — only after commit — the
  resulting `enrollmentId`). Idempotent per decision.
- **Step 1 — Close the current year:** `AcademicYearStatus → CLOSED`; **lock academic records**;
  finance stays open. No Student/Enrollment mutation.
- **Step 2 — Ensure next year exists** (`UPCOMING`).
- **Step 3 — Review every student:** list every `Active` enrollment; **highlight** those needing
  manual review (failed subjects / missing grades / administrative or finance holds). Never silently
  promote — every student gets an explicit decision or stays `DECIDE_LATER`.
- **Step 4 — Promotion preview:** build a preview of what *would* be created. **Nothing is written
  yet — no `Enrollment`, no `Charge`, no `PaymentPlan`, no finance record of any kind** (Rev. 3
  Decision 5). The preview lives only as `YearEndDecision` draft rows. Administrators review and may
  revise; the whole draft is discardable (reversible).
- **Step 5 — Commit after Final Confirm:** on explicit confirmation, the wizard calls the **shared
  pipeline
  (5a)** for every promoted/repeated student in one controlled transactional batch, stamps outgoing
  enrollments `Promoted`/`Repeated`, and closes graduating enrollments as `Graduated` (Student
  untouched, Decision 7). Historical enrollments never change.

### 5c. Promotion copy rules (Decision 10)

On promote/repeat, **auto-copy only:** Guardian Links, Financial Account reference, Student Identity,
**Optional Transport (configurable, off by default).** **Do NOT auto-copy Section or Classroom** —
schools reorganise every year. Administrators **must assign Grade, Section and Classroom** during
Year-End Processing (Grade defaults are *suggested* by promotion, not silently applied).

---

## 6. Database impact

All additive except the two flagged structural changes; no ledger change; no automatic business-data
migration.

| Change | Type | Notes |
|---|---|---|
| `AcademicYear` re-scope campus → **school** (`schoolId`, `@@unique[tenantId, schoolId, name]`) | **structural** | backfill `schoolId` from `campus.schoolId`; per-tenant validation first (§3). |
| `AcademicYearStatus` enum + `AcademicYear.status`; one-`ACTIVE`-per-school partial index; no-delete guard | additive | backfill `ACTIVE` where `isCurrent`, else by date. |
| **New `AdmissionStatus` enum** on the admission artifact | additive | split out of the current enum (§4c). |
| `EnrollmentStatus` **redefined to participation set**; remap `COMMITTED/ACTIVE→Active` | additive enum + data update | admission-phase rows move to the admission artifact. |
| `Enrollment` new columns: `campusId, classroomId, admissionDate, withdrawalDate, graduationDate, reason, areaId, transportRequested` | additive nullable | placement/lifecycle moves here from `Student`. |
| `Student.studentNumber` + `StudentNumberCounter` (gapless per-tenant) | additive | Decision 6; `@@unique[tenantId, studentNumber]`. |
| Deprecate `Student.status`/`sectionId`/`enrollmentDate`/`areaId`/`transportRequested` (shim, then drop) | **behavioral → removal** | written only by the lifecycle writer during transition; dropped in the final step. |
| `YearEndProcess`, `YearEndDecision` | new tables | standard tenant + RLS + audit; preview holds no Enrollment. |
| Optional `WithdrawalSettlement`, `AdmissionCancellation` audit records | new tables | thin records over existing ledger ops (§8); no new ledger primitives. |
| Reporting view: per-year enrollment ↔ attendance/grades/behavior/documents | new view | no data move; joins through Enrollment. |

Every new table: `tenantId` NOT NULL, `tenant_isolation` RLS, `tenantId`-leading indexes,
in-transaction `writeAudit`.

---

## 6a. Academic-Year migration validator (Rev. 3 Decision 1)

A standalone, read-only validator (`scripts/validate-academic-year-migration.ts`) is the **gate**
before the Phase-B school-scoped cleanup. Per tenant it:

1. Groups `AcademicYear` by `(schoolId, name)` and reports any group with > 1 row — a **duplicate
   conflict** (would violate the future `@@unique[tenantId, schoolId, name]`).
2. Reports any School with > 1 `ACTIVE` year — a **single-active conflict**.
3. Emits a human-readable **conflict report** (per tenant, per school, listing the offending years +
   ids) and a machine-readable JSON.
4. **Exits non-zero if any conflict exists**, so the deploy/cleanup pipeline **aborts**. Zero rows are
   changed by the validator.

Phase B (constraint swap + `campusId` drop) runs **only** when the validator passes for the tenant.
Administrators resolve conflicts (rename / retire duplicate years) via normal admin tooling first.
**No silent merge, no automatic consolidation.**

---

## 7. Backend impact

- **`StudentIdentityService.lookupByIdentifier(nationalId | moeStudentNumber)`** — the single
  identity check driving admission Cases A/B/C (§9). National ID primary, MoE fallback, **exact match
  only**, tenant-scoped. No fuzzy / name / DOB comparison, ever.
- **`StudentNumberService`** — gapless allocation of `studentNumber` (Decision 6), row-locked counter.
- **`EnrollmentLifecycleService`** — sole writer of `EnrollmentStatus` transitions (§4b) and, during
  transition, of the deprecated `Student` shims + derived current-enrollment projection; audits every
  transition.
- **`AdmissionWorkflowService`** — owns `AdmissionStatus` transitions (§4a) on the admission artifact,
  distinct from the enrollment lifecycle.
- **`RegistrationCommitService` (extended)** — the **one** pipeline for admission / re-enrollment /
  promotion / repeat (Decision 3), parameterised by `existingStudentId` + mode.
- **`AcademicYearService`** — school-scoped status transitions, single-`ACTIVE` enforcement, closure
  lock, no-delete guard.
- **`YearEndProcessingService`** — preview (no writes) → confirm → batch via the shared pipeline;
  reversible until commit (Decision 9).
- **Guards:** `ClosedYearReadOnlyGuard` (academic mutations keyed on year status);
  `DeletableOnlyIfDraftGuard` (§13); `AcademicYearNoDeleteGuard`.
- **Permissions:** reuse `Registrar/SchoolAdmin/Principal/FinanceOfficer`; add
  `enrollment:promote/withdraw`, `academicyear:close`, `yearend:process`.

Existing endpoints keep working behind a feature flag until the unified admission replaces the two
legacy flows.

---

## 8. Finance impact (Decision 11 — do not redesign)

**Ledger not redesigned, not migrated.** All orchestration over existing primitives:

- **Re-enrollment / promotion finance:** new Enrollment → new `Charge`s (already dimensioned by
  `academicYearId`/`enrollmentId`) → new `PaymentPlan` + `Installment`s via
  `ChargeService.createInstallments`. Prior-year charges **never rewritten**; balances aggregate up
  the `Payer` across years (already true).
- **Withdrawal settlement (academic event ≠ financial event):** `WithdrawalSettlementService` runs
  school policy as existing ledger ops — cancel remaining tuition (`→ CANCELLED`), keep registration
  fee, charge current month, refund transport/books (`Refund`+`RefundConsumption`), apply penalties
  (`FeeAdjustment`). Nothing deleted; all recorded. Only a thin `WithdrawalSettlement` audit record.
- **Cancel Admission (pre-active):** void charges, policy refund, cancel transport, release seat, keep
  audit — distinct from withdrawal (§13).
- **Financial Account continuity:** withdrawing one child never closes the `Payer`; siblings and the
  control balance untouched.
- **Outstanding balances span years** and remain collectible after year closure (Decision 11, 12).
- **JoFotara / receipts:** unchanged, reused via `FinanceBridgeService`.

---

## 9. Admission impact

**Collapse the two flows** (`/admissions` and `/admissions/family`) into **one** wizard; the
single-student case is the degenerate N=1 of the account flow.

1. **Financial Account** — select existing or create (Decision 5: payer may be parent / grandparent /
   employer / sponsor / charity / embassy / ministry) → resolves/creates the `Payer`.
2. **Identity** — enter National ID (or MoE number) → **immediate `lookupByIdentifier`**:
   - **Case A — not found:** normal admission → Student (+ auto `studentNumber`) + admission artifact
     → on Registered, Enrollment + Charges + Plan + Agreement via the shared pipeline.
   - **Case B — found with an Active enrollment:** *"already enrolled"* → **Open Student** / **Open
     Financial Account**. No new admission.
   - **Case C — found, no active enrollment (last Withdrawn/Completed):** *"previously enrolled"* →
     **Re-Enroll** via the shared pipeline with `existingStudentId`. **Never create a new Student.**
3. **Similar-name warning (informational only):** a soft warning if a very similar name exists —
   **never blocks, never substitutes for the National-ID identity check.**

---

## 10. Parent Portal impact

- **Student profile is read-only for finance** — show Financial Account, Outstanding Summary, Current
  Enrollment, and immutable **Enrollment History** (year · grade · status). No payment collection /
  ledger editing / installment management on the student page; those live only on the Financial
  Account.
- Multi-year history is a straight read over `Enrollment` ordered by Academic Year.
- Withdrawn/graduated children still show full history; the Financial Account keeps aggregating.

---

## 11. Reporting impact

- **Two clearly distinct report families (Decision 2):** admission-funnel reports off `AdmissionStatus`
  (Draft/Quoted/Accepted/Registered/Cancelled); participation reports off `EnrollmentStatus`
  (Active/Completed/Promoted/Repeated/Graduated/Withdrawn/Archived). Never conflated.
- **Academic-Year filter** on every enrollment-based report (dimension already on `Enrollment`/`Charge`).
- **Closed years remain fully reportable** — closure locks editing, not reading (Decision 12).
- Cross-year financial reports roll up the `Payer` and span years via `Charge.academicYearId`.
- Per-year enrollment↔academic view (§6) scopes attendance/performance by year without touching
  Student.

---

## 12. Historical data (Decision 12)

Every closed `Enrollment` is **historical and immutable**. Previous Academic Years remain available —
Attendance, Grades, Timetables, Homework, Behaviour, Documents, Finance, Audit Logs, Reports — and are
**never overwritten**. Enforced by the closed-year read-only guard + append-only audit; an optional DB
trigger is the belt-and-suspenders.

---

## 13. Deletion & Cancel-Admission rules

- **Hard delete allowed only when** the admission artifact is `Draft` **and no dependent records**
  exist. Otherwise **hide Delete**; offer **Withdraw** (post-active) or **Cancel Admission**
  (pre-active).
- Students keep soft-delete (`deletedAt`) so identifiers free correctly (existing partial-unique
  behavior). **Never delete a student with history** (Decision 7).
- **Academic Years are never deletable** (Decision 8).
- **Cancel Admission ≠ Withdrawal:** cancel voids charges / policy-refunds / releases seat *before*
  active; withdrawal closes an *active* enrollment and runs settlement. Both keep all audit history.

---

## 14. Rollback strategy

- Additive migrations paired with a **down** dropping only new columns/tables/enum values.
- The AcademicYear campus→school re-scope keeps `campusId` during transition (nullable, deprecated)
  so rollback is non-destructive.
- Unified admission ships **behind a `FeatureFlag`**; legacy flows stay reachable until proven, then
  removed in an isolated PR.
- Derived-status backfill and Student-Number backfill are idempotent and re-runnable.
- **Year-End is reversible until commit** (Decision 9); a mis-promotion after commit is corrected by
  withdrawing/cancelling the *new* enrollment — history stays intact.

---

## 15. Risk analysis

| Risk | Severity | Mitigation |
|---|---|---|
| AcademicYear campus→school re-scope on live data | **High** | per-tenant validation before migrate; keep `campusId` shim; single-calendar reality makes collisions rare; flag, don't auto-merge. |
| `Student.status`/`sectionId` load-bearing across modules | High | deprecate as shims written only by the lifecycle writer; migrate readers incrementally; drop last. |
| Two status concepts confused in code/reporting | High | separate enums on separate entities (§4); mechanical split of the old enum. |
| Silent/accidental promotion | High | preview-then-confirm; explicit per-student decision; `DECIDE_LATER` default; review highlights (Decision 9). |
| Section/classroom wrongly auto-copied | Medium | Decision 10 — only guardian/account/identity/optional-transport copied; grade/section/classroom admin-assigned. |
| Closed-year edits leaking through | Medium | status-keyed guard + append-only audit + optional DB trigger. |
| Two admission flows drifting during transition | Medium | feature-flag; delete legacy in a dedicated follow-up. |
| Student-Number format/uniqueness | Low | gapless row-locked counter (proven pattern); `@@unique[tenantId, studentNumber]`. |
| Similar-name warning mistaken for identity check | Low | informational only; identity is National-ID/MoE exact match. |

---

## 16. Ratified decisions (locked for implementation)

| # | Decision | Effect on the design |
|---|---|---|
| **1** | Academic Year is **School-scoped**; exactly one `Active` per School; campuses participate. Concurrent years are a future multi-school-group feature, not multi-campus. | §3 re-scope campus→school; single-ACTIVE-per-school index. ▲ reverses Rev. 1. |
| **2** | **Separate** `AdmissionStatus` (Draft/Quoted/Accepted/Registered/Cancelled) from `EnrollmentStatus` (Active/Completed/Promoted/Repeated/Withdrawn/Graduated/Archived). | §4 two enums on two entities. ▲ reverses Rev. 1. |
| **3** | **One shared Enrollment-creation pipeline** for Admission / Re-enrollment / Promotion / Repeat. No separate implementations. | §5a extend `RegistrationCommitService`. |
| **4** | **Student holds no mutable academic info** (grade, section, classroom, enrollment status, academic year, transport, fee plan, advisor, timetable). Identity only. | §2 move all placement to Enrollment; derived projections. |
| **5** | Rename remaining payer-representing **"Family" → "Financial Account"**; payer may be parent/grandparent/employer/sponsor/charity/embassy/ministry. | §9 + a rename sweep (routes/UI/DTO/i18n). |
| **6** | Add internal **Student Number**, auto-generated by the school, separate from National ID / MoE; on report cards, QR cards, attendance sheets, library cards, certificates. | §2a new field + counter. |
| **7** | **Graduation closes the Enrollment only**; Student never archived/removed; permanent for transcripts/verification/reporting. | §2, §5b, §13. |
| **8** | Academic Year lifecycle `Upcoming/Active/Closed`; **never deletable**. | §3 status + no-delete guard. |
| **9** | Year-End Processing is **preview → administrator review → commit-only-after-confirmation**; **no Enrollment created until confirm**; **reversible until commit**. | §5b. |
| **10** | Promotion auto-copies only Guardian Links / Financial Account / Identity / optional Transport; **admin assigns Grade, Section, Classroom**; never auto-copy Section/Classroom. | §5c. |
| **11** | **Do not redesign** Financial Account / Ledger / Charges / Billing / Payment Plans — integrate only; historical ledgers immutable; balances span years. | §8. |
| **12** | Closed enrollments are historical and **never overwritten**; all domains remain readable. | §12. |
| **13** | **Governing principle:** Student is permanent identity; everything year-varying lives on Enrollment or another year-scoped entity; never duplicate mutable academic info on Student — for this and every future module. | top-of-document + §1. |

---

## 17. Recommended implementation roadmap (only after Rev. 2 approval)

> **Build status:** ✅ Step 1 (Academic Year → School-scoped + status) · ✅ Step 2 (Admission vs.
> Enrollment status split, `admissionStatus` on Enrollment) · ✅ Step 3 (year-scoped placement columns
> on Enrollment, admission writes them, `EnrollmentLifecycleService` = sole participation-status writer
> + derived Student-status projection; `Student` academic columns kept as deprecated shims) · ✅ Step 4
> (internal Student Number — configurable per-tenant `StudentNumberCounter`, gapless allocation on
> every student create, backfilled for existing students, searchable, shown on the profile) · ✅ Step 5
> (single Enrollment-creation pipeline — `createEnrollmentRowTx` is now THE one place an Enrollment row
> is born, both admission paths route through it, and together with the shared `createEnrollmentCharges`
> it is the pipeline re-enrollment/promotion/repeat reuse — no separate implementations) · ✅ Step 6
> (identity-first admission backend — `StudentIdentityService.lookupByIdentifier` resolves National ID
> primary / MoE fallback, exact match, into cases A=NEW / B=ACTIVE / C=RETURNING, plus an informational
> similar-name warning; endpoints + admin lib wired) · ✅ Step 7 (re-enrollment — `reEnroll` derives the
> returning student's Financial Account, guards duplicate-year enrollment, and delegates to the shared
> add-to-account pipeline with `existingStudentId`; the student is never recreated and prior ledgers are
> untouched) · ✅ Step 8 (Year-End Processing wizard — `YearEndProcess`/`YearEndDecision`; open+review
> board seeds DECIDE_LATER per active student and highlights missing-grades for review; preview→Final
> Confirm creates NOTHING until commit; commit promotes/repeats via the shared pipeline (admin-assigned
> grade/section — never auto-copied) and graduates/withdraws via the lifecycle service; resumable +
> idempotent per student) · ✅ Step 9 (enrollment exit — `withdraw` runs the academic event via the
> lifecycle service then settles by cancelling remaining UNPAID charges per policy, keeping paid amounts
> and the registration fee; `cancelAdmission` voids a pre-active admission and is refused once any money
> is settled; both reuse `ChargeService.cancel`, redesign no ledger, delete no history) · ✅ Step 10a
> (deletion guard — a student is hard-deletable only with NO dependent records
> [enrollments/attendance/grades/finance/documents/transport/clinic/cards]; else the API refuses and
> names the blockers, and `GET :id/deletability` drives showing Delete vs. Withdraw/Cancel; plus
> `GET :id/enrollment-history` for the immutable per-year history). Each shipped additive, reversible,
> audited.
>
> ✅ **Step 10b (part 1 — profile UI):** the student profile now shows an immutable **Enrollment
> History** card (per-year: year · grade · section · status + dates) and **gates Delete on
> `deletability`** — hiding it with a "Withdraw/Cancel instead" hint when dependent records exist.
> Admin production build passes.
>
> ✅ **Step 11 (reporting):** `GET /admissions/enrollments/stats?academicYearId=` returns the two
> DISTINCT breakdowns (Decision 2) — participation `byStatus` and admission-funnel `byAdmissionStatus`
> — plus a total, filterable by Academic Year (closed years stay reportable, Decision 12). The
> admissions report page shows an Enrollment-summary card (Total/Active/Promoted/Repeated/Graduated/
> Withdrawn/Registered/Pending). Admin build passes.
>
> **Remaining (deferred UI / cleanup):** identity-first admission wizard rendering A/B/C + collapse the
> two admission screens; read-only-finance enforcement on the student profile; Family→Financial Account
> rename sweep — all UI-heavy and best done with browser review. **Step 12 (Phase-B destructive
> cleanup)** — drop the deprecated `Student` academic columns + swap AcademicYear uniqueness — is
> intentionally NOT executed here: those columns are still read by attendance/portal/reporting shims,
> and per Rev. 3 it must run only AFTER the new architecture is validated in production.
>
> **Remaining for the unified-admission UI (folded into Step 10):** collapse the two admission screens
> (`/admissions` + `/admissions/family`) into one identity-first wizard behind a feature flag, render the
> A/B/C branches, and the "Family" → "Financial Account" rename sweep.

1. **Academic Year → School-scoped + status machine** — re-scope migration (validated), `Upcoming/
   Active/Closed`, single-ACTIVE-per-school index, no-delete + closure-lock guards. *(Foundational.)*
2. **Split statuses** — new `AdmissionStatus` on the admission artifact; redefine `EnrollmentStatus`
   to the participation set; mechanical remap (§4c).
3. **Move placement off Student** — add year-scoped `Enrollment` columns; introduce
   `EnrollmentLifecycleService` (sole writer) + derived current-enrollment projection; deprecate the
   `Student` academic shims.
4. **Student Number** — `StudentNumberCounter` + `studentNumber`; wire into cards/report/attendance/
   library/certificate surfaces.
5. **Shared Enrollment pipeline** — extend `RegistrationCommitService`; fold family
   MERGE/SEPARATE/NEW_PLAN in as a mode.
6. **Unified Admission (A/B/C)** — `StudentIdentityService.lookupByIdentifier`; identity-first entry;
   similar-name warning; collapse the two flows behind a feature flag; **"Family"→"Financial
   Account"** rename sweep.
7. **Re-enrollment** through the shared pipeline.
8. **Year-End Processing wizard** — `YearEnd*` models; review board; **preview → confirm** batch via
   the shared pipeline; promote/repeat/graduate/withdraw; reversible until commit.
9. **Withdrawal settlement + Cancel Admission** — orchestration over the existing ledger.
10. **Deletion guard + student-profile read-only finance + Enrollment History UI.**
11. **Reporting** — split admission-funnel vs. participation reports; Academic-Year filter; per-year
    view.
12. **Retire legacy admission flow; drop deprecated `Student` academic columns; remove the feature
    flag.**

Each step is independently shippable, additive where possible, reversible, and audited. No step
redesigns the ledger or auto-migrates business data.

---

**Rev. 2 incorporates all 13 ratified decisions. Awaiting approval of this revision before writing any
code or schema.**
