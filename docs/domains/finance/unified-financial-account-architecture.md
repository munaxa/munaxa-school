# Munaxa — Unify Admissions & Finance Around the Financial Account

**Status:** Architecture review — awaiting approval before implementation.
**Type:** Enterprise refactor (consolidation), not a feature.
**Principle:** ONE Admission, ONE Finance, ONE Agreement generator, ONE Statement engine — the workflow adapts to the *customer* (the Financial Account), never to a hard-coded "student" or "guardian".

---

## 0. Executive position (read this first)

The recent family-billing work shipped the right **domain model** (a `FinancialAccount` that owns plans/payments/credits/refunds over student-owned charges, with a reused allocation engine) but the **wrong topology**: it added *parallel* screens and endpoints beside the student-centric ones instead of unifying them. That is the duplication you are objecting to, and it is correct to object.

So this refactor is mostly **subtraction, not addition**: collapse two admission flows into one, two finance flows into one, and make the single-student case the *degenerate N=1* of the account-centric flow. I am **not** proposing a new parallel system.

I also want to **challenge three things in the proposal** up front, because getting them right is what makes this last 10 years:

1. **Drop the word "Family."** Your own business model says the payer may be a company, embassy, government, sponsor, or divorced parents. "Family Finance"/"Family Admission" bakes in the very assumption you are removing. The canonical noun is **Financial Account** (or just **Account**). I recommend renaming everything "family*" → "account*" as part of this work, while it is still new and has no production data.

2. **We now have TWO payer representations — that is duplicate data, and you explicitly warned against it.** The legacy `Payer` (name/phone/email/parentId) and the new `FinancialAccount` (ownerType/parentId/**payerId**/name/phone/email) overlap. The FinancialAccount even carries a `payerId`. This must be reconciled *now* (§3.2), not left to rot. My recommendation: FinancialAccount is the customer + grouping; it **references exactly one `Payer` as its billing identity** (the JoFotara buyer), and does **not** duplicate contact fields. This is a decision point I need from you.

3. **The single-student admission must also create a Financial Account.** Backward-compatibility is about *existing* data, not *new writes*. If new single-student admissions keep skipping the account, the branch never dies and we are back to two code paths forever. The unified `commit` should always resolve-or-create an account (N=1 is just a family of one).

Everything below assumes these three positions unless you override them.

---

## 1. Review of the proposed architecture

The proposal is **directionally correct and I endorse its intent**: one admission, one finance, one agreement, one statement, account-as-customer, reuse the ledger and allocation engine, no auto-migration. My only material changes are the three challenges above (naming, payer de-duplication, single-student unification) plus one modelling gap the proposal understates: **collections is still student-scoped** (`CollectionsCase` is 1:1 with `StudentFinancialAccount`). "Finance always opens the account" implies an account-level collections status, which today is only a per-student rollup. That needs an explicit plan (§9, §16).

Verdict: approve the goal; adjust the four points above; the rest is consolidation of code that already exists.

---

## 2. Better alternatives (challenging assumptions)

| Proposal element | Assessment | Better / refined design |
|---|---|---|
| "Family" naming | Contradicts the non-hardcoded-payer goal | Rename to **Financial Account / Account** everywhere (routes, UI, DTOs, i18n). |
| Two payer entities (`Payer` + `FinancialAccount`) | Duplicate data (name/phone/email twice) | **Control-account + subsidiary-ledger** pattern: `FinancialAccount` = customer/control account, referencing ONE `Payer` for billing identity; `StudentFinancialAccount` = per-student subsidiary ledger. No duplicated contact fields. |
| Keep single-student `commit` as a separate path | Perpetuates two code paths | Make `commit` a **thin N=1 adapter** over the account commit — one write path, one set of invariants. |
| "Merge / Separate / New plan" as a distinct add-student API | Fine, but it is a *mode of the one admission*, not a second endpoint | Fold into the single admission service as a parameter; the UI presents it as a step, not a separate screen. |
| Account-level collections implied but unmodelled | Understated risk | Phase it: keep per-student cases; add an **account rollup** now; move case ownership to the account in a later, isolated migration. |
| One agreement per account | Already implemented (agreement is per guardian+year) | Keep; just make its *source of truth* the account + its plan (already done) and re-label "guardian" → "account holder". |

**The one accounting frame that makes all of this coherent:** treat the `FinancialAccount` as a **control account** and each `StudentFinancialAccount` as a **subsidiary ledger**. This is standard double-entry ERP practice, it is *exactly* why the existing per-student ledger can be reused untouched, and it gives a principled answer to every "where does X live?" question:

- Balances roll **up** (student sub-ledgers → account control balance).
- Obligations (charges/discounts/scholarships) live **down** at the student.
- Settlement instruments (plans/payments/credits/refunds/statements/agreements/collections) live **up** at the account.
- The allocation engine is the bridge: an account payment is distributed down to student-charge installments.

---

## 3. Domain model review

### 3.1 Target (canonical)

```
Payer  (billing identity: legal name, tax id, contact)  ─┐
                                                          │ 1
                                              FinancialAccount  ── ownerType (GUARDIAN|COMPANY|GOVERNMENT|SPONSOR|…)
                                                 (customer / control account)
                                                 owns: PaymentPlan, Payments, Credits, Refunds,
                                                       Statements, Agreements, Collections
                                                          │ 1..N
                                              StudentFinancialAccount  (per-student subsidiary ledger)
                                                 owns: Charges, Adjustments (discounts/scholarships), per-student balance
                                                          │
                                                       Charge → Installment ← PaymentAllocation ← Payment (account)
```

### 3.2 The `Payer` vs `FinancialAccount` reconciliation (decision required)

Today (post family-billing) both exist and both store name/phone/email. Options:

- **Option A (recommended): FinancialAccount *references* a Payer; drop its duplicated contact columns.**
  `FinancialAccount.payerId` (already present) becomes the identity source. `Payer` remains the entity `Payment`/`Credit`/`Refund` FK to (unchanged), and is the JoFotara buyer. Least schema churn, removes duplication, no data to migrate (feature is new). `ownerType` stays on the account.
- **Option B: FinancialAccount *subsumes* Payer.** Cleaner conceptually but rips `payerId` FKs out of Payment/Credit/Refund — high blast radius on the ledger. Not worth it.
- **Option C: leave both (status quo).** Rejected — it is the duplicate data you warned against.

I recommend **A**. It keeps the ledger's `payerId` contracts intact, gives JoFotara a stable buyer identity, and eliminates the duplication.

### 3.3 `ownerType`

Already an enum (`GUARDIAN, GRANDPARENT, COMPANY, CHARITY, SPONSOR, GOVERNMENT, SCHOLARSHIP_ORG, COURT_ORDER, RELATIVE, OTHER`). The payer is therefore **not** hard-coded as guardian. Keep. The account↔guardian link (`parentId`) becomes *optional* (a company account has no parent). This is already the case in the schema.

---

## 4. Modules affected

| Module | Change class |
|---|---|
| Admissions (API) | **Consolidate**: one `commit` path; single-student = N=1 over the account commit. `family/commit` becomes the canonical implementation; `commit` a thin adapter. `add-student` folds into the same service. |
| Admissions (UI) | **Delete** `/admissions/family`; the single `/admissions` wizard gains the guardian→account resolution + add-student step. |
| Finance (API) | Account-first read models become primary; `finance/accounts/:studentId` + `finance/students/:studentId` remain as **drill-downs**, not the entry point. |
| Finance (UI) | **Delete** `/finance/families`; `/finance` becomes account-first search → account dashboard → student drill-down (reusing the existing `FinanceTab`). |
| Agreements | Re-label guardian→account holder; source already the account plan. |
| Statement engine | `forAccount` primary; `forStudent` is the drill-down. One engine. |
| Collections | Add account rollup now; account-owned cases later (§9). |
| Reporting | Default group = account; drill-down = student (already added; make it the default, remove any student-only default). |
| Parent portal | Already account/landing shaped; ensure it reads the account, child = expand. |
| Ledger / allocation | **No change** (reused). |
| JoFotara | Buyer identity sourced from the account's Payer (§10). |
| Nav + i18n | Remove duplicate "Family *" entries; keep one Admission, one Finance. |

---

## 5. Database impact

**Minimal, additive, and mostly *removing* duplication — no new tables.**

1. **De-duplicate the payer (Option A):** drop `FinancialAccount.nameEn/nameAr/phone/email` (or keep as nullable snapshot overrides), rely on `payerId`. *(Safe: the feature is new; production has no FinancialAccount rows yet.)*
2. **No new entities** for the unification itself — `FinancialAccount`, `FinancialAccountPlan`, and the nullable `financialAccountId`/`financialPlanId` FKs already exist and are correct.
3. **Collections (later phase):** add nullable `financialAccountId` to `CollectionsCase` and a rollup, without breaking the existing `studentFinancialAccountId` 1:1. No destructive change.
4. **Backfill:** none. Existing student-only data keeps `financialAccountId = NULL` and behaves as today.

Everything remains one additive migration (plus the drop of the just-added duplicate columns). Reversible.

---

## 6. Backend impact

- **Admissions service:** collapse to one commit. `commitAccount(dto)` handles 1..N students, resolve-or-create account, one plan, aligned per-charge plans. `commit(legacyDto)` → adapter calling `commitAccount` with one student. Idempotency keys already per-student-indexed.
- **Account resolution:** `ensureForParentTx` generalises to `ensureForPayer` (guardian is one payer kind). The guardian link becomes optional.
- **Read models:** `FinancialAccountService.dashboard` + `StatementService.forAccount` are primary; the student versions delegate/drill-down. No duplicated aggregation — both derive from the same ledger rows (single source of truth).
- **DI hygiene:** the recent startup crash (StatementService needing `FinancialAccountRepository` inside `DocumentsModule`) is a reminder to **boot the Nest graph in CI** (§16). Consolidation reduces the number of cross-module re-provisions.

---

## 7. API impact

| Concern | Direction |
|---|---|
| `POST /admissions/commit` | Kept (backward compat) → internally creates an account (N=1). Marked the legacy shape. |
| `POST /admissions/family/commit` | Becomes the canonical account commit; **alias** `POST /admissions/account/commit`. Keep `family/*` as deprecated alias for one release. |
| `POST /admissions/family/:id/add-student` | → `POST /admissions/account/:id/add-student` (alias retained). |
| `finance/families/*` | → `finance/accounts/*` **account** routes (not to be confused with the per-student `finance/accounts/:studentId`; I recommend renaming the per-student one to `finance/student-accounts/:studentId` to remove the collision). |
| `finance/accounts/:studentId`, `finance/students/:studentId/statement` | Retained as **drill-down** endpoints. |

No breaking removals in this release — only additions of canonical names + deprecation of "family". Old clients keep working.

---

## 8. Finance impact

- One entry point: search (guardian/family/phone/national id/student) → **always resolves to the account**. Student search returns the student's account.
- Account dashboard = KPIs (Outstanding, Credit, Paid, Next Installment, Collections status, Children) + children list; selecting a child expands the existing per-student `FinanceTab` (charges/outstanding/invoices/discounts/payments) **read-only for plan management** — all plan/payment operations happen at the account.
- No figure is computed twice; account totals are Σ of the subsidiary ledgers (control-account rollup).

---

## 9. Ledger impact

- **Zero change to the ledger's meaning.** Charges stay student-owned; allocations still target a single installment; discounts/scholarships/waivers/write-offs/credit-memos/refunds unchanged.
- Account payment → **cross-student FIFO** across the union of the account's students' open installments (already implemented, tested end-to-end). Residue → account credit.
- **Collections** is the one place where "reuse the ledger" is incomplete: `CollectionsCase` is 1:1 with the student sub-ledger. Plan:
  - **Now:** account dashboard shows the *rollup* (most-severe child status) — already done.
  - **Later (isolated phase):** introduce account-level case ownership (nullable `financialAccountId` on `CollectionsCase`, dunning at the account), migrating per-student cases lazily. No historical rewrite.

---

## 10. JoFotara impact

- Invoices originate from **charges** (student-owned) — unchanged. A family payment produces per-installment/per-charge settlement, so JoFotara still sees student charges and per-charge credit notes.
- **Buyer identity** should come from the account's **Payer** (legal name, tax id) rather than being re-derived per student — this is *more* correct for a company/sponsor account, and Option A (§3.2) gives it a single home.
- Gapless receipt/ICV counters unchanged. **Regression-test the bridge on the account payment path** (already flagged in the prior plan; keep it in the verify gate).

---

## 11. Agreement impact

- Already one agreement per account (guardian+year); source of truth is the account plan with a legacy merge fallback.
- Changes: **re-label** "Guardian" → "Account holder" and source identity from the account's Payer (so a company account renders the company as the signatory). No structural change; snapshot immutability, fingerprinting, and supersede logic preserved.

---

## 12. Parent Portal impact

- Already account-shaped (`/parent/finance/summary`: outstanding, next installment, total paid, credit, history, children). Ensure it resolves the **account** for the acting guardian (fallback to linked children for legacy). Child click = expand detail without losing the account summary. No separate finance module. Minor: guarantee a guardian who is one payer of a multi-payer account sees only what they are entitled to (scope check).

---

## 13. Reporting impact

- **Default group = account**; drill-down = student (both already implemented). Make account the default in the UI and remove any student-first default.
- Reports: Outstanding Accounts / Outstanding Students, Account Statement / Student Statement, Collections, Revenue — all from the same ledger rows. No duplicated report logic.

---

## 14. Migration strategy

1. **Reconcile the payer (Option A)** — drop duplicate columns while the feature has no prod data. *(zero-risk now, expensive later.)*
2. **Unify the write path** — single-student `commit` creates an account; `family/commit` → canonical `account/commit` + alias.
3. **Unify the UI** — fold `/admissions/family` into `/admissions`; fold `/finance/families` into `/finance`; delete the duplicates; keep redirects for one release.
4. **Rename** family→account across routes/DTOs/i18n/nav; keep deprecated aliases.
5. **Collections account rollup** (read) now; account-owned cases in a later isolated phase.
6. **Existing schools:** untouched. New admissions use the unified flow. Optional guided migration tool later (create accounts for existing guardians from their `ParentStudent` links, wiring remaining unpaid installments — **never** rewriting paid history).

No automatic data migration. No historical rewrite.

---

## 15. Rollback strategy

- Every family/account path stays gated on `financialAccountId`; reverting the UI/route commits restores the student-first screens without touching data.
- The only destructive DDL is dropping the duplicated `FinancialAccount` contact columns — reversible (re-add nullable) and safe because there is no prod data in that table yet. If that is a concern, keep the columns as nullable snapshot and simply stop writing them (fully non-destructive).
- Deprecated aliases mean old API clients never break during the transition; removal is a later, separate decision.
- Feature-flag the unified admission/finance UI so a school can be flipped back instantly.

---

## 16. Risk analysis

| Risk | Severity | Mitigation |
|---|---|---|
| **Nest DI graph breaks at startup** (as just happened) | High (whole API 404s) | **Add a CI smoke test that boots the Nest app** (resolves the graph, maps routes) — this would have caught the `DocumentsModule` crash. Non-negotiable for this refactor. |
| Route/name collision `finance/accounts/:studentId` vs account routes | Medium | Rename per-student to `finance/student-accounts/:studentId`; keep alias. |
| Payer de-duplication touching JoFotara buyer | Medium | Option A centralises buyer identity; regression-test 3 e-invoice flows on the account path. |
| Collections still student-scoped | Medium | Rollup now, account ownership later; never in the same PR as the UI unification. |
| Deleting `/finance/families` while a user has it bookmarked | Low | 301 redirect to `/finance` for one release. |
| Performance: account rollups over many children | Low | Aggregations are indexed by `studentId`/`financialAccountId`; cap and paginate; measure before/after. |
| Scope creep (rewriting the ledger) | High if unmanaged | Hard rule: the ledger, allocation, audit, and JoFotara code is **read-only** in this refactor. |

---

## 17. Recommended implementation order (safest first)

1. **CI: Nest boot smoke test** + payer reconciliation (Option A schema change). *(Foundational; catches the class of bug that just broke prod.)*
2. **Unify the write path** (admissions): `account/commit` canonical, `commit` = N=1 adapter, `add-student` folded in; aliases for `family/*`. Verify: single + multi-student both create an account; ledger/agreement unchanged.
3. **Unify Finance read/entry** (API): account-first as primary; per-student as drill-down; rename per-student account route.
4. **Unify Admissions UI**: one wizard (guardian→account resolution + add-student step); delete `/admissions/family` (redirect).
5. **Unify Finance UI**: account-first `/finance`; delete `/finance/families` (redirect); student = expand `FinanceTab`.
6. **Rename family→account** across DTOs/i18n/nav; drop the "Family" vocabulary.
7. **Reporting + Parent portal**: account default, student drill-down (largely done — verify).
8. **Agreements/JoFotara**: account-holder labelling + buyer identity from the account Payer; regression-test.
9. **Collections account rollup** (read-only) — as its own PR.
10. Full regression gate at each step: ledger integrity, audit completeness, JoFotara, reporting accuracy, performance, **and a booting API**.

Later / optional: account-owned collections cases; guided migration tool for existing schools.

---

**Nothing is implemented yet. Please review the four challenges in §0 (naming, payer de-duplication [Option A], single-student unification, collections phasing) and approve or adjust before I begin.**

---

## 18. APPROVED — finalized decisions (locked)

Approved by the product owner with one architecture-improving refinement:

1. **One workflow.** Remove the duplicated Admission/Family-Admission and Finance/Family-Finance flows; a single context-aware flow operates on the Financial Account. UI vocabulary is **Financial Account** (payer-neutral), not "Family".
2. **Collapse `FinancialAccount` into `Payer` (Option A, refined).** `Payer` becomes the **canonical Financial Account** — the single financial-identity entity. Do NOT keep two identity models.
   - Verified premise: siblings under one guardian **already share one `Payer`** (`ensurePayerForStudentTx` dedupes by `parentId`), and every ledger FK already references `payerId` (`Payment`, `Credit`, `Refund`, `StudentFinancialAccount`). `Payer` is therefore already the grouping entity; the shipped `FinancialAccount` table is redundant.
   - **Extend `Payer`** with `ownerType` (guardian/company/government/sponsor/…), `status`, `currency` (+ optional `nationalId`/`taxId` for JoFotara buyer identity).
   - **Drop** the redundant `FinancialAccount` table and the parallel `financialAccountId` columns; reuse the existing `payerId` everywhere. Repoint the account payment plan (`FinancialAccountPlan`) to `payerId`.
   - No historical migration of payments/ledger; existing schools keep working (their `payerId` links are unchanged).
   - Physical table name stays `Payer` (heavily FK'd) — the *domain concept* is "Financial Account".
3. **One write path (N=1).** Every new admission creates/loads a Financial Account (Payer) and adds 1..N students. Single-student is the degenerate case of the same code. Legacy account-less records untouched.
4. **Full account-owned collections now.** `CollectionsCase` moves to the account (Payer) level; migrate existing per-student cases into one account case using the most-severe status (LEGAL > FINANCIAL_ISSUE > NONE), merging notes and preserving history for audit. Students expose a **read-only** collections status that references the account's case; students never own a case again.

**Cross-cutting mitigation (approved §16):** add a CI smoke test that boots the Nest application (resolves the DI graph + maps routes) — the class of failure that caused the recent outage and that typecheck/unit tests do not catch.

Implementation proceeds in the §17 order, adjusted for the Payer consolidation, in coherent, compiling, tested increments.
