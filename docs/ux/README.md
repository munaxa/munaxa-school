# Munaxa UX Architecture

**Purpose:** the enterprise UX contract — how records, navigation, search, history, approvals and
tenant context behave across every Munaxa surface.
**Audience:** engineers and AI agents building Munaxa screens; designers proposing new patterns.
**Authority:** binding for Munaxa product UI.

These documents describe **product** behaviour. The visual layer beneath them — tokens, themes,
components, accessibility floor — belongs to the shared platform and is documented at
[`platform/README.md`](../../../platform/README.md).

> These documents are published by the design-system reference site under
> [`munaxadesignsystem/`](../../munaxadesignsystem), which indexes them in
> `client/src/enterprise-standards/registry.ts`. Moving or renaming one means updating that
> registry in the same commit.

---

## Read in this order

Building a screen from scratch? These four, in sequence:

1. [ai-product-architecture.md](./ai-product-architecture.md) — the order to build in: workspaces
   before pages, records before widgets, relationships before duplication.
2. [workspaces.md](./workspaces.md) — the workspace model.
3. [record-workspaces.md](./record-workspaces.md) — the anatomy of a record screen.
4. [ai-generation-rules.md](./ai-generation-rules.md) — the prohibitions, before you generate.

## Structure

| Document | Purpose | When to read |
| --- | --- | --- |
| [workspaces.md](./workspaces.md) | The workspace model: what a workspace is and what belongs in one | Designing any new area |
| [record-workspaces.md](./record-workspaces.md) | The record screen: header, summary, tabs, related records, timeline, audit | Building a record detail screen |
| [navigation.md](./navigation.md) | Global, workspace and context navigation; breadcrumbs; deep linking | Adding a route or a nav entry |
| [action-panel.md](./action-panel.md) | Where actions live and how they are grouped | Adding an action to a record |

## Relationships and history

| Document | Purpose | When to read |
| --- | --- | --- |
| [related-records.md](./related-records.md) | Linking records instead of copying their data | Two records reference each other |
| [timeline.md](./timeline.md) | Business history: what happened and what it means | Showing chronological history |
| [activity-feed.md](./activity-feed.md) | Recent, permission-safe activity streams | Building a feed |
| [audit-trail.md](./audit-trail.md) | The immutable compliance evidence layer and its data model | Any sensitive action |
| [domain-relationships.md](./domain-relationships.md) | How Munaxa's domain records relate | Modelling a new relationship |

**Timeline, activity feed and audit trail are three different things.** Timeline is business
history for humans making decisions; activity feed is awareness; audit trail is immutable
compliance evidence. A feed may summarise audit events but never replaces them, and history is
never editable — corrections create a new event.

## Finding things

| Document | Purpose | When to read |
| --- | --- | --- |
| [search-architecture.md](./search-architecture.md) | Authorised global and domain search, suggestions, saved searches, filters | Working on search |
| [search-pattern.md](./search-pattern.md) | The universal search UI pattern | Placing a search affordance |

## Control: permissions, workflow, tenancy, compliance

| Document | Purpose | When to read |
| --- | --- | --- |
| [permissions-ux.md](./permissions-ux.md) | How capability, scope, state and field-level permissions affect rendering | Gating any UI |
| [workflow-ux.md](./workflow-ux.md) | Approvals, states and transitions as explicit state machines | Building an approval flow |
| [multi-tenant-ux.md](./multi-tenant-ux.md) | Tenant, school, campus, year, term and role context safety | Anything showing tenant-scoped data |
| [audit-compliance-ux.md](./audit-compliance-ux.md) | Audit logs, change history, reasons, compliance evidence in the UI | Sensitive or reversible actions |
| [notifications-ux.md](./notifications-ux.md) | Notification surfaces and behaviour in the UI | Surfacing a notification |

The backing implementations are documented under
[`../architecture/`](../architecture/README.md): permissions in
[05-rbac-matrix.md](../architecture/05-rbac-matrix.md), audit in
[10-audit-logging-strategy.md](../architecture/10-audit-logging-strategy.md), notifications in
[13-notification-architecture.md](../architecture/13-notification-architecture.md) and
[13b](../architecture/13b-notification-platform-implementation.md). **These UX documents describe
behaviour; those describe mechanism.** Where they appear to disagree, the architecture document
describes what is built and the UX document describes what should be true — report the gap.

## Content and data

| Document | Purpose | When to read |
| --- | --- | --- |
| [content-design.md](./content-design.md) | Voice, tone, terminology, microcopy, bilingual EN/AR messaging | Writing any user-facing string |
| [data-visualization.md](./data-visualization.md) | Decision-led charts, metrics, dashboards and their accessibility | Building a chart or dashboard |

## Domain components

| Document | Purpose | When to read |
| --- | --- | --- |
| [domain-components-architecture.md](./domain-components-architecture.md) | How Munaxa domain components compose over platform primitives | Adding a domain component |
| [domain-components-catalog.md](./domain-components-catalog.md) | The catalogue: props, variants, states | Looking for an existing component |

Domain components are **Munaxa-specific** compositions (status badges, record headers, student
and employee cards). They live in `apps/admin/src/components/domain` and must never move into the
platform — see [`/PLATFORM_ENGINEERING_STANDARDS.md`](../../../PLATFORM_ENGINEERING_STANDARDS.md) §2.

## Rules for AI agents

| Document | Purpose |
| --- | --- |
| [ai-product-architecture.md](./ai-product-architecture.md) | The build order and the generation sequence |
| [ai-generation-rules.md](./ai-generation-rules.md) | What AI-generated interfaces must cover and must never do |
| [ai-domain-guidelines.md](./ai-domain-guidelines.md) | Rules for composing Munaxa domain components |

These are **UI-specific** and sit underneath the repository-wide rulebook,
[`/PLATFORM_ENGINEERING_STANDARDS.md`](../../../PLATFORM_ENGINEERING_STANDARDS.md). Where they
disagree, the rulebook governs.

## Governance and meta

| Document | Purpose |
| --- | --- |
| [design-governance.md](./design-governance.md) | Design-system ownership, contribution, review, versioning, migration, deprecation |
| [documentation-architecture.md](./documentation-architecture.md) | How this documentation is structured and published |
| [website-design-reference.md](./website-design-reference.md) | The public marketing site's design reference |
