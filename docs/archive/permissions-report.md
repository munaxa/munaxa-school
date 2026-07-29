# PERMISSIONS_REPORT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration — **Phase 9 (Permissions Review)**
**Date:** 2026-06-18 · Branch `claude/affectionate-shannon-fbfeaf` · Status ✅ (assessment) · **no code change**

> No routes/APIs/logic changes. Authorization is ultimately backend-enforced (out of scope).

## Assessment

| Concern | State | Detail |
|---|---|---|
| **Role-based rendering** | 🟢 | `app-shell` filters the entire nav by `principal.permissions` (each item has a `perm`); feature-flagged modules drop out too. Plane indicator (platform/school) reflects `isPlatform`. |
| **Protected pages** | 🟢 | unreachable via nav without the permission; backend also protects the routes. (Note: no client-side route guard component — protection is nav + API. Direct URL nav relies on API rejection.) |
| **Protected actions** (create/edit/delete) | 🟡 | mostly **not** individually gated in the UI; they rely on (a) the page being nav-gated and (b) the API rejecting unauthorized calls. The dashboard models the good pattern (`held.has('report:read')`). DS prefers **hide/disable** of unauthorized actions rather than fail-on-click. |
| **Approval workflows** | 🟡 | finance refunds/over-payment flows exist; approval gating is backend/policy-driven, not a distinct UI approval surface yet (overlaps Phase 10). |
| **Read-only views** | 🟢 | e.g. the Student profile dialog is explicitly read-only; viewers without edit perms still see data where the page is reachable. |
| **Permission errors** | 🟡 | surfaced through each page’s generic error state (the API error message); no dedicated 403 “you don’t have access” treatment or reference id. `ErrorState` (added Phase 4) is available to standardize this. |

**Verdict:** the security baseline is sound (nav gating + backend enforcement). The design-system gaps are **UX-level**: per-action hide/disable and a dedicated permission-error treatment.

## Why no code change this phase
Retrofitting per-action permission gating requires an authoritative **action → permission-key map** (e.g. which key guards “delete teacher”, “issue refund”). Inferring those keys and wiring them across ~20 pages risks either over-hiding legitimate actions or under-protecting — a correctness/behavior risk that violates the “preserve functionality” mandate. This is best done deliberately with the permission catalog, so it is scoped as a tracked follow-up rather than guessed at here.

## Roadmap
- Introduce a small `usePermissions()` / `<Can permission=…>` helper and gate destructive/sensitive actions to **hide or disable** (with tooltip) when not held — driven by the existing `/roles/catalog` keys.
- Standardize permission errors on `ErrorState` with a “request access” affordance + reference id.
- Optional client route-guard for direct-URL hardening (defense-in-depth; API already enforces).

**STOP — Phase 9 complete.** Proceeding to Phase 10 (Audit & Compliance).
