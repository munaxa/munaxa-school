# Activity Feed Pattern

## Purpose

Activity Feed provides a readable stream of recent, permission-safe business activity for a record, team, or workspace. It supports awareness; Audit Trail provides compliance evidence.

## Activity types

User action, workflow transition, approval, notification/delivery, system calculation, relationship change, document event, and exception/resolution.

## Filters and sorting

Filter by activity type, actor, related record, and date. Default newest-first for operational feeds; provide chronological episode view when investigation requires it. Persist shareable filters in the URL without sensitive values.

## Audit rules

Feed entries may summarize multiple low-level audit events but never replace them. Link sensitive changes to Audit Trail when authorized. Never allow editing history; corrections create a new event.

## Examples

Student: guardian verified and document accepted. Attendance: register submitted and absence resolved. Finance: payment settled and receipt issued. Communication: announcement approved and delivered.

## Accessibility and RTL

Use feed/list semantics, descriptive event titles, real timestamps, keyboard filters, and non-color types. Announce newly inserted activity without stealing focus. Use logical flow and isolate IDs, times, and amounts in RTL.

