# MUNAXA Search UX Architecture

## Purpose

Search finds authorized records and relationships quickly while preserving tenant, school, campus, academic-year, term, and role context. Search never becomes a side channel for protected data.

## Principles

Scope is visible. Authorization is applied before ranking/counting. Results are record-centric. Keyboard and Arabic input are first class. Queries and recent history follow privacy retention policy.

## Search types

| Search | Primary fields | Filters | Safe result context |
|---|---|---|---|
| Global | permitted record names/IDs and references | type, school/campus, status | type, label, safe ID, scope, relationship hint |
| Student | name, student ID, verified guardian | grade, class, enrollment | grade, campus, status |
| Teacher | name, employee ID, subject | campus, subject, assignment | department, campus, status |
| Parent | name, verified email/phone, linked child | relationship, verification | linked-child hint only when permitted |
| Finance | account/payer/student | school, balance status, aging | account, currency, balance state |
| Invoice | invoice ID, payer, student | date, status, amount range | ID, amount, due date, state |
| Attendance | student, class, register ID | date, status, resolution | class/date/state |
| Report | title, owner, category | freshness, schedule, scope | owner, updated time, scope |

Sensitive notes, safeguarding, health, payroll, payment credentials, and unverified relationships are never searchable by default.

## Result pattern

Each result has record type/icon, primary label, safe identifier, school/campus scope, status, match explanation when safe, and deep link. Group global results by type, cap preview groups, and offer “View all.” Ranking uses exact ID, prefix, name, permitted relationship, recency, and user context without leaking global popularity.

## Suggestions and recent/saved searches

Suggestions come from permitted record types, fields, and recent authorized entities—not raw protected values. Recents are user/tenant scoped, clearable, retention-limited, and invalidated after permission/context change. Saved searches store typed filters and sort, show owner/scope, and re-evaluate permission on every run.

## Advanced filters

Use progressive disclosure. Active filters appear as removable text chips, have a clear-all action, update result counts accessibly, and serialize safe values into the URL. Dependent filters reset transparently when school/year/role context changes.

## States

- Initial: recent searches and domain shortcuts.
- Loading: input remains active; stale results clearly marked or removed.
- No results: repeat safe query/scope and suggest spelling/filter changes.
- No authorized results: never confirm protected records exist.
- Error: retain query/filters, state recovery, retry, and support reference.
- Partial/offline: label source and freshness; never imply completeness.

## Responsive flows

Desktop uses command dialog or full results with grouped preview and shortcut. Tablet uses full-width overlay with filter drawer. Mobile uses dedicated full-screen search, sticky input, large targets, filter sheet, and reliable back-to-origin behavior.

## Keyboard

Default shortcut is Ctrl/Cmd+K for global search when it does not conflict with platform/browser policy. Arrow keys move results, Enter opens, Escape closes and restores focus, Tab reaches filters/actions, and screen readers receive result count and active option. Preserve Arabic IME composition.

## Complete UX flow

~~~mermaid
flowchart LR
  Open --> Context[Show active tenant/school]
  Context --> Query
  Query --> Authorize[Authorize + scope before search]
  Authorize --> Results
  Results --> Filter
  Filter --> Results
  Results --> Record[Open record workspace]
  Record --> Return[Return to exact query/filter/scroll]
~~~

## English and Arabic examples

English placeholder: Search students, teachers, invoices, and reports. Arabic: ابحث عن الطلاب والمعلمين والفواتير والتقارير.

English empty: No authorized records match “MUN-2048” in Main Campus. Arabic: لا توجد سجلات مصرح بها تطابق «MUN-2048» في الحرم الرئيسي.

## Accessibility and RTL

Use labelled combobox/listbox patterns, correct active descendant or roving focus, visible focus, announced counts/loading/errors, touch targets, zoom/reflow, and non-color status. In RTL, use logical alignment, Arabic collation, and direction isolation for IDs, emails, amounts, and phone numbers.

## Do / Don’t

Do show scope, preserve origin, support exact IDs, and reauthorize saved searches. Don’t search unauthorized indexes then filter the UI, expose hidden counts, highlight sensitive match text, or retain queries indefinitely.

## Implementation notes

Search APIs receive tenant and effective scope from the authenticated session, not client-supplied scope alone. Index documents carry access partitions and field classifications. Log sensitive searches/exports according to audit policy without storing unnecessary query content.

