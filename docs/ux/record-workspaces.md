# Munaxa Record Workspace Patterns

## Record Workspace Pattern

**Purpose:** provide one durable home for a record’s identity, state, relationships, work, and history.

~~~text
Record Header                         Actions Panel
Summary Metrics
Overview | Domain tabs | Activity
Primary tab content
Related Records
Activity Timeline
Audit Trail
~~~

Use a stable route based on record ID. Keep identity and status visible. Use tabs only for durable facets, not one-off actions. Put time-ordered business history in Timeline and immutable security/compliance history in Audit Trail.

Accessibility: one page heading, labelled tabs, logical focus order, named actions, non-color state, table alternatives, and announced async updates. RTL: logical positioning and isolated identifiers/amounts. Dark mode: semantic surfaces only.

## Student Workspace Pattern

- Header: student name, ID, grade, campus, enrollment status, and safe quick actions.
- Metrics: attendance, balance where permitted, open documents, and active alerts.
- Tabs: Overview, Attendance, Finance, Documents, Communication, Activity.
- Related: Guardians, Invoices, Attendance Alerts, Messages.
- Timeline: enrollment, attendance resolution, communications, and document events.
- Audit: identity, relationship, enrollment, permission-sensitive view/export, and archival changes.
- Never show Finance tab to teachers or unrelated guardians.

## Teacher Workspace Pattern

- Header: teacher identity, employment/assignment status, department, and quick actions.
- Metrics: classes, students, workload, attendance, and pending tasks.
- Tabs: Overview, Schedule, Classes, Attendance, Communication, Activity.
- Related: Classes, assigned students, schedules, messages, and delegated approvals.
- Timeline and audit remain separate; HR/payroll data is outside this teaching workspace unless independently authorized.

## Parent Workspace Pattern

- Header: guardian identity, verification status, relationship scope, and actions.
- Children Summary is prominent and each child link establishes a new record context.
- Tabs: Overview, Children, Finance, Communication, Activity.
- Related: verified children, payments, consent requests, and messages.
- Never aggregate an unverified or expired relationship.

## Finance Workspace Pattern

- Account header names payer/account, school scope, currency, and lifecycle state.
- Balance summary and collection metrics include period and freshness.
- Tabs: Overview, Invoices, Payments, Statements, Activity.
- Related: students, parents, invoices, payments, receipts, refunds, approvals.
- Settled records are immutable. Corrections are reversal/adjustment events with approval references.

## Communication Workspace Pattern

- Header identifies message/campaign, owner, audience, state, and schedule.
- Delivery metrics distinguish queued, delivered, read, failed, and suppressed.
- Tabs: Overview, Announcements, Messages, Templates, Activity.
- Related: audience segments, templates, approvals, delivery attempts, and source records.
- Protect previews and recipient data according to channel and role.

## Usage rules

Prefer one workspace with related records over duplicated dashboards. Preserve record context through actions. Revalidate permissions and record version at transition. Keep action panels short and move infrequent actions to explicit menus.

## Examples

Live Student, Teacher, Parent, Finance, Attendance, Communication, and Reports workspace examples are available in the Enterprise Workspace Architecture section.

