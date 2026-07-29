# Timeline Pattern

## Purpose

Timeline communicates meaningful chronological business history. It helps users understand what happened, current consequence, and possible next action. It is not a substitute for the immutable audit log.

## Events and grouping

Each event has ID, type, actor/source, record reference, occurred-at time, display time, title, safe detail, workflow state, visibility scope, and optional action. Group by day or business episode, not arbitrary visual chunks. Preserve chronological truth when localized.

## Filtering

Filter by event type, actor class, date range, workflow, and related record. Filters remain URL-addressable. Default filters never silently hide critical events.

## Event types

- User actions: edits, submissions, communication, manual resolution.
- System events: imports, calculations, delivery attempts, policy escalation.
- Approval events: requested, reassigned, approved, rejected, expired.
- Audit events are linked when relevant but remain available in Audit Trail.

## Best practices

Use concise past-tense titles, show actor and exact timestamp on demand, link related records, collapse noisy machine retries into a summary, and retain failed events. Do not insert decorative milestones or edit past events in place.

## Accessibility and RTL

Use ordered-list semantics, headings for date groups, real time elements, text labels, and keyboard actions. In RTL, keep chronology in domain order, use logical layout, and isolate IDs/timestamps.

## Examples

Student: enrolled, guardian verified, absence resolved. Finance: invoice issued, payment settled, receipt generated. Communication: approved, delivered, delivery exception. Attendance: marked absent, guardian notified, excused, closed.

