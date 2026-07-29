# Munaxa Workspace Architecture

## What is a workspace

A workspace is the persistent operating context for a record, role, or bounded process. It brings identity, state, decisions, relationships, history, and governed actions together so users do not have to reconstruct context across disconnected pages.

## Workspace hierarchy

~~~text
Global shell
└── Organization / school scope
    └── Domain workspace
        └── Record workspace
            ├── Context tabs
            ├── Related records
            ├── Timeline
            └── Action / audit surfaces
~~~

Global scope controls tenant and school. Domain workspaces organize queues and aggregates. Record workspaces own one durable entity such as Student, Teacher, Parent, Applicant, Invoice, Payment, Route, or Announcement.

## Ownership

Every workspace defines a product owner, data owner, permission owner, workflow owner, and support escalation. Ownership is metadata, not an implied permission. The active record ID, school/campus scope, workflow state, and freshness remain visible.

## Actions

Actions are record transitions, not generic buttons. Primary actions advance the current goal. Secondary actions support review or communication. Dangerous actions require explicit confirmation and audit reason. Approval actions show impact, policy, approver, and separation of duties.

## Permissions

Apply capability + scope + record state from permissions-ux.md. APIs filter data before render and revalidate every mutation. Workspaces support full, read-only, partially authorized, approval-pending, and denied modes without revealing protected relationships.

## Navigation

Global navigation changes product domain. Workspace navigation changes stable record facets. Context navigation follows relationships. Breadcrumbs express hierarchy, never browsing history. Every tab and related record has a deep link that preserves safe scope and filter state.

## Relationships

Relationships are first-class, effective-dated records with type, direction, state, and permission. Related data is linked rather than copied. Cross-navigation preserves origin so users can return to the exact tab, filter, and scroll context.

## Examples

- Student workspace: enrollment, attendance, finance, documents, communication, guardians, and history.
- Finance workspace: account balance, invoices, payments, statements, related students/parents, and audit.
- Communication workspace: governed message lifecycle, delivery, audience, templates, and recipient results.

## Release rules

Workspaces must include loading, empty, partial, error, conflict, read-only, denied, approval, and offline behavior where relevant. They meet WCAG 2.2 AA, use logical RTL layout, and preserve enterprise dark mode through semantic tokens.

