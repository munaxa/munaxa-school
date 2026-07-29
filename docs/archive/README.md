# Archive — historical reports

**Purpose:** preserve the reasoning and evidence from completed programmes.
**Audience:** anyone asking "why is it like this?" or "what did we already try?".
**Authority: none.** These documents are **not** current guidance.

> ⚠️ **Read this before using anything here.**
>
> Every document in this folder is a **point-in-time report**. It records what was true on a
> date, under a branch, during a programme that has since finished. Several describe structures
> that no longer exist — `packages/config-tailwind`, `packages/ui`, app-local `components/ui`
> barrels, the violet brand palette, the `--coral` / `--aqua` token names.
>
> **Do not follow them. Do not edit them.** They are evidence, and evidence that gets edited
> stops being evidence.
>
> For what is true now, start at [`/docs/README.md`](../../../docs/README.md).

---

## Why these are kept

Point-in-time reports answer questions no living document can:

- **What did we already consider?** Avoids re-running an analysis that was already done.
- **Why does this look odd?** Most surprising structures were a deliberate trade-off, recorded
  here at the moment it was made.
- **What was the state before a migration?** The only record of the "before" side.

Deleting them would make the codebase cheaper to read and much more expensive to change.

## Contents

### Design-system migration programme (2026-06-18)

A phased audit-and-migration of the Munaxa admin portal onto a shared design system. Superseded
by the platform extraction; the structures it describes have since moved.

| Document | Phase |
| --- | --- |
| [design-system-audit.md](./design-system-audit.md) | 1 — full application audit, 29 routes |
| [design-system-discovery.md](./design-system-discovery.md) | Discovery and inventory |
| [token-migration-report.md](./token-migration-report.md) | Token migration |
| [typography-migration-report.md](./typography-migration-report.md) | Typography migration |
| [component-migration-report.md](./component-migration-report.md) | Component migration |
| [domain-component-report.md](./domain-component-report.md) | Domain component extraction |
| [workspace-architecture-report.md](./workspace-architecture-report.md) | 6 — workspace architecture |
| [search-architecture-report.md](./search-architecture-report.md) | 7 — search architecture |
| [multi-tenant-report.md](./multi-tenant-report.md) | 8 — multi-tenant UX |
| [permissions-report.md](./permissions-report.md) | 9 — permissions review |
| [dark-mode-report.md](./dark-mode-report.md) | 10 — dark mode |
| [accessibility-report.md](./accessibility-report.md) | 11 — accessibility |
| [rtl-report.md](./rtl-report.md) | RTL sweep |
| [performance-report.md](./performance-report.md) | Performance |
| [audit-compliance-report.md](./audit-compliance-report.md) | Audit and compliance |
| [pattern-compliance-report.md](./pattern-compliance-report.md) | Pattern compliance |
| [munaxa-design-system-compliance-report.md](./munaxa-design-system-compliance-report.md) | Overall compliance |

### Design-system monorepo refactor

| Document | Subject |
| --- | --- |
| [design-system-monorepo-refactor.md](./design-system-monorepo-refactor.md) | The refactor that produced `@school/design-tokens`, `@school/icons` and `@school/ui` — later extracted into `@axa/platform` |
| [design-system-audit-site.md](./design-system-audit-site.md) | Audit from the design-system reference website |
| [design-system-roadmap.md](./design-system-roadmap.md) | The roadmap that programme worked to |
| [design-system-ideas.md](./design-system-ideas.md) | Exploration notes |

### Programme snapshots

| Document | Subject |
| --- | --- |
| [implementation-progress.md](./implementation-progress.md) | Delivery progress snapshot |

---

## Adding to the archive

When a programme finishes, move its dated reports here, add a row above, and make sure the
living document that replaced them says what it replaced. Never move a *living* document here —
if it still describes current intent, it belongs in `architecture/`, `domains/` or `ux/`.
