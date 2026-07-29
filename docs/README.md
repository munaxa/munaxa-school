# Munaxa Documentation

**Purpose:** everything written about the Munaxa School Operating System.
**Audience:** engineers, architects, operators and AI agents working on Munaxa.

The repository-wide entry point is [`/docs/README.md`](../../docs/README.md). This page is the
Munaxa-specific map.

> **Before changing anything**, read
> [`/PLATFORM_ENGINEERING_STANDARDS.md`](../../PLATFORM_ENGINEERING_STANDARDS.md) — the rulebook
> that governs how work is done in this repository.

---

## Layout

```
school/docs/
├── architecture/     binding system architecture (numbered) + adr/
├── domains/          per-domain design: hr, finance, attendance, transport, …
├── ux/               UX architecture and the enterprise pattern library
├── phases/           delivery history, phase by phase
├── ops/              deployment, infrastructure, monitoring, runbooks
├── security/         audits and security-sensitive flows
├── integrations/     external systems (JoFotara e-invoicing)
├── design-system/    Munaxa brand assets (colour lives in the platform)
├── marketing/        campaign and creative material
└── archive/          dated point-in-time reports — historical, never edited
```

## Where to start

| I want to… | Go to |
| --- | --- |
| Resume work after a break | [HANDOFF.md](./HANDOFF.md) |
| Understand the system | [architecture/00-system-architecture.md](./architecture/00-system-architecture.md) |
| Find where code lives | [architecture/01-monorepo-architecture.md](./architecture/01-monorepo-architecture.md) |
| Add a backend module | [architecture/02-domain-architecture.md](./architecture/02-domain-architecture.md), [capability-ownership-matrix.md](./architecture/capability-ownership-matrix.md) |
| Write a query or a migration | [architecture/03-multi-tenant-architecture.md](./architecture/03-multi-tenant-architecture.md), [architecture/04-database-erd.md](./architecture/04-database-erd.md) |
| Add an endpoint | [architecture/06-api-architecture.md](./architecture/06-api-architecture.md) |
| Gate a feature | [architecture/05-rbac-matrix.md](./architecture/05-rbac-matrix.md), [ux/permissions-ux.md](./ux/permissions-ux.md) |
| Build a record screen | [ux/record-workspaces.md](./ux/record-workspaces.md), [ui-governance.md](./ui-governance.md) |
| Notify someone | [architecture/13-notification-architecture.md](./architecture/13-notification-architecture.md), [architecture/13b-notification-platform-implementation.md](./architecture/13b-notification-platform-implementation.md) |
| Deploy or operate | [ops/README.md](./ops/README.md) |
| Understand a business area | [domains/](#domains) below |

## Architecture

The binding blueprint — conform to it, or supersede it with an ADR.
Index: [architecture/README.md](./architecture/README.md).

Cross-cutting: [capability-ownership-matrix.md](./architecture/capability-ownership-matrix.md)
records which module owns which capability and the seams between them. Read it before adding any
feature that spans two modules.

Decision records: [architecture/adr/](./architecture/adr/). ADRs are immutable — supersede,
never edit.

## Domains

Living per-domain design documents.

| Domain | Entry point |
| --- | --- |
| **HR** | [domains/hr/README.md](./domains/hr/README.md) — lifecycle, org, contracts, leave, payroll attendance, performance, assets, recruitment, self-service |
| **Finance** | [domains/finance/finance-domain-specification-v1.md](./domains/finance/finance-domain-specification-v1.md) — the canonical specification |
| **Attendance** | [domains/attendance/structure-ui.md](./domains/attendance/structure-ui.md) — see also [HR attendance](./domains/hr/attendance-enterprise-architecture.md) |
| **Student lifecycle** | [domains/student-lifecycle/architecture-review.md](./domains/student-lifecycle/architecture-review.md) |
| **Enrolment** | [domains/enrollment/](./domains/enrollment/) |
| **Transport** | [domains/transport/redesign.md](./domains/transport/redesign.md) |
| **Scheduling** | [domains/scheduling/engine-refactor.md](./domains/scheduling/engine-refactor.md) |
| **Academic year** | [ACADEMIC_YEAR_STRUCTURE.md](./ACADEMIC_YEAR_STRUCTURE.md) |

## UX and design

| Document | Purpose |
| --- | --- |
| [ui-governance.md](./ui-governance.md) | **Authoritative.** How Munaxa consumes and enforces the shared platform; the UI "never" list |
| [ux/README.md](./ux/README.md) | The enterprise UX architecture and pattern library |
| [design-system/README.md](./design-system/README.md) | Munaxa brand assets. Colour and components live in the platform |

Colour, tokens, typography and components are **not** documented here — they belong to the shared
platform. See [`platform/README.md`](../../platform/README.md).

## Operations and security

- [ops/README.md](./ops/README.md) — deployment, infrastructure, monitoring, runbooks, load
  testing, production readiness, [Cloudflare deploy](./ops/cloudflare-deploy.md)
- [deployment-staging.md](./deployment-staging.md) — the staging environment
- [PLATFORM_CONSOLE.md](./PLATFORM_CONSOLE.md) — the multi-tenant operator console
- [security/](./security/) — the June 2026 security audit and the password-reset flow
- [integrations/jofotara/](./integrations/jofotara/) — Jordanian national e-invoicing

## Delivery history

[phases/](./phases/) records phases 1–15, from foundation to production hardening. Each phase
document states what was built and what it superseded. These are historical but still useful as
the reasoning behind current structures.

## Archive

[archive/README.md](./archive/README.md) — dated reports from completed programmes. **Historical
evidence, not current guidance.** Several describe structures that no longer exist.
