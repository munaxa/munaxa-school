# MUNAXA Multi-Tenant UX Architecture

## Purpose

Multi-tenant UX keeps users continuously aware of where they are acting and prevents data or actions from crossing tenant, school, campus, year, term, role, or branch boundaries.

## Principles

Context is persistent, visible, and verified at mutation. Switching is deliberate and reversible. Aggregate views are distinguishable from actionable local views. Data isolation is enforced by the platform and reflected by UX.

## Context hierarchy

~~~text
Tenant / organization
└── School
    └── Campus / branch
        └── Academic year
            └── Term
                └── Effective role
                    └── Record workspace
~~~

Not every product exposes every level. Hidden levels still exist in the authorization and audit context.

## Switching standards

| Switch | Pattern | Required behavior |
|---|---|---|
| Tenant | Account-level switcher with strong separation | Reauthenticate when policy requires; clear unsafe local state |
| School | Persistent School Selector | Show logo/name, current role, confirmation for unsaved work |
| Campus/branch | Context header selector | Update permissions, dashboards, filters, and available actions |
| Academic year | Labelled year selector | Keep historical mode visibly read-only where applicable |
| Term | Dependent selector | Restrict to selected year and effective dates |
| Role | Explicit role switch | Explain capability change; never combine incompatible roles silently |

## What users should always know

Active organization, school/campus or “All campuses,” year/term, effective role when switched/delegated, record identity, and whether the view is live, historical, aggregate, or read-only.

## Context header

The Tenant Context Header presents organization/school, campus, academic period, and effective role in stable order. It announces changes, updates the URL safely, and remains visible in exports, approvals, destructive confirmations, and audit records.

## Selector patterns

School Selector supports search, recent schools, verified identity, and keyboard navigation. Campus and Year selectors are dependent and disable invalid combinations with reasons. Selector options never reveal unauthorized tenants/campuses.

## Multi-campus dashboard

Clearly label “All campuses.” Use comparative metrics and exceptions; do not offer campus-specific mutations from aggregate context unless the action explicitly requests target campuses and previews impact.

## Cross-campus reporting

Show included campuses, missing/partial sources, currency/timezone/calendar differences, aggregation method, and export scope. Permission filters apply before aggregation; hidden campuses do not leak through totals.

## Preventing wrong-context actions

- Put context in record header and action confirmation.
- Revalidate context, permission, record version, and effective dates at submit.
- Warn before switching with unsaved work; offer save draft/discard/cancel.
- Reset incompatible selections and explain what changed.
- Use distinct “All campuses” text—not a blank selector.
- Include school/campus in duplicate names, notifications, browser title, and export filename.

## Permission visibility and isolation UX

Navigation and search show only authorized contexts. Read-only historical context is labelled. A denied context switch returns the prior safe context. Server isolation applies to APIs, cache keys, indexes, files, exports, jobs, notifications, analytics, and logs.

## English and Arabic examples

English: You are recording attendance for Main Campus · 2026/27 · Term 1. Arabic: أنت تسجل الحضور للحرم الرئيسي · ٢٠٢٦/٢٠٢٧ · الفصل الأول.

English confirmation: Send this announcement to 1,242 parents across two campuses? Arabic: هل تريد إرسال هذا الإعلان إلى ١٬٢٤٢ ولي أمر في حرمين؟

## Accessibility and RTL

Selectors have visible labels, current value, search semantics, keyboard support, focus restoration, and live announcement. Context is never communicated by color/logo alone. Use logical layout and Arabic names; isolate years, IDs, and account references.

## Do / Don’t

Do persist safe context, display aggregate mode, include context in confirmations, and clear unsafe cache after switching. Don’t rely on color themes per tenant, silently retain incompatible filters, combine role permissions, or let users mutate records from ambiguous scope.

## Enterprise best practices

Use a centralized effective-context service, context version in API requests, scoped caching, context-aware telemetry, recent-context history, delegated-role expiry, and audit events for tenant/role switching. Support large customer hierarchies with searchable selectors and favorites.

## Implementation notes

Represent context as tenantId, schoolId, campusId, academicYearId, termId, roleGrantId, and contextVersion. The server derives allowable combinations. Mutations include contextVersion and fail safely when stale.

