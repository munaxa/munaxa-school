# PERFORMANCE_REPORT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration — **Phase 14 (Performance)**
**Date:** 2026-06-18 · Branch `claude/affectionate-shannon-fbfeaf` · Status ✅ (assessment) · **no code change**

> No routes/APIs/logic changes.

## Bundle profile (production build)

- **Shared First Load JS: ~105 kB** (React 19 + Next runtime) — healthy.
- **Per-route First Load: 132–153 kB** — tight band, no outliers.
- **Largest route bundles:** `/people/students` 9.7 kB, `/finance` 8.5 kB, `/settings/integrations/jofotara` 5.9 kB, `/fleet` 5.5 kB — all reasonable.
- **No heavy dependencies:** no charting lib, no moment/date-heavy lib; fonts self-hosted woff2 (variable Latin shared across display+body = one asset); icons not bundled wholesale.
- The new `@school/ui` primitives are lightweight (no Radix/animation runtime pulled in).

## Findings

| Area | State | Detail |
|---|---|---|
| **Bundle size** | 🟢 | lean, consistent; design-system consolidation added negligible weight |
| **Largest components** | 🟡 | `finance/page.tsx` (~986 LOC) and `students/page.tsx` are large *source* files (maintainability, not runtime) — candidates for sub-component extraction |
| **Table rendering** | 🟡 | lists render all rows (no virtualization). Fine at typical school scale; could matter for very large datasets |
| **Search performance** | 🟢 | students search is **debounced (300 ms)** + server-side; staff/list filters are in-memory over small sets |
| **Dashboard** | 🟢 | single overview fetch; lightweight custom bar (no chart lib) |
| **Rendering** | 🟢 | mostly static/client components; no obvious render storms; `useMemo` used in filter-heavy pages (employees) |
| **Fonts/images** | 🟢 | `next/font` self-hosted (content-hash dedup), `next/image` logo |

## Verdict
Performance is **good**; the design-system migration did **not** regress bundle size and removed some duplication (shared primitives, domain badges). No urgent optimizations required.

## Roadmap (only if scale demands)
- **Virtualized tables** (e.g. for students/finance) if real datasets reach thousands of rows.
- **Split `finance/page.tsx`** into per-section components (statement / charges / payments / installments) — maintainability + smaller per-interaction re-renders.
- **Route-level code-splitting** of rarely-used heavy sections (e.g. jofotara wizard) via dynamic import if they grow.
- Add `aria-busy`/skeleton loaders on async sections (pairs with Phase 11 a11y).

**STOP — Phase 14 complete.** Proceeding to Phase 15 (Final Compliance Report).
