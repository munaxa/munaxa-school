# Audit Trail Pattern

## Purpose

Audit Trail is the immutable evidence layer for sensitive record access, change, workflow transition, approval, export, and policy action. It is distinct from the user-facing activity timeline.

## Data model

| Field | Requirement |
|---|---|
| Event ID | Globally unique and immutable |
| Record | Type, ID, tenant, school/campus scope |
| Actor | User/service ID, role/capability context, delegation |
| Timestamp | Server UTC time plus localized display |
| Action | Stable machine code and safe display label |
| Previous value | Field-level, protected/redacted as policy requires |
| New value | Field-level, protected/redacted as policy requires |
| Reason | Required for elevated, destructive, correction, and override actions |
| Approval reference | Request, approver, policy, outcome |
| Request context | Correlation ID, channel, trusted client/network metadata |

Audit records are append-only, retention-controlled, tamper-evident, permission-scoped, and exportable only with explicit audit capability.

## Examples

- Student: identity corrected, guardian linked, enrollment changed, archived.
- Attendance: submitted register corrected, absence reason changed, case closed.
- Finance: invoice adjusted, payment reversed, refund approved, write-off posted.
- Settings: threshold changed, role granted, integration key rotated.

## UX rules

Provide filters, exact timestamps, actor/source, reason, approval link, and field diff. Redact inaccessible values without breaking event meaning. Never let users edit or delete audit events.

## Accessibility and RTL

Use a semantic table for comparison, labelled filters, keyboard expansion, and non-color diffs. In RTL, isolate values, IDs, IP-like data, timestamps, and amounts while retaining logical field order.

