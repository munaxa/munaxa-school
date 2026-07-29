# MUNAXA Audit and Compliance UX

## Purpose

Audit and compliance UX makes sensitive access, change, approval, and correction understandable and reviewable without allowing history to be rewritten. It supports school policy, financial controls, privacy, incident response, and accountable operations.

## Principles

- Audit evidence is immutable, complete, permission-scoped, and server-timestamped.
- Activity timeline explains business history; audit log proves system events.
- Sensitive actions require clear consequence, reason, and sometimes approval.
- Corrections create new linked events; they never overwrite evidence.
- Compliance interfaces minimize protected data while preserving meaning.

## Audit surfaces

| Surface | Purpose | Audience |
|---|---|---|
| Activity Timeline | Readable business history | Record users |
| Change History | Field/version comparison | Authorized operators |
| Audit Log | Immutable event evidence | Auditors/security/admin |
| Approval Queue | Governed pending decisions | Authorized approvers |
| Sensitive Action Dialog | Consequence, reason, confirmation | Action initiator |

## Audit record standard

Every event includes who changed it, effective role/delegation, tenant/school/campus, server timestamp, record/type, action, source/channel, previous value, new value, reason, approval reference, correlation ID, and outcome. Protected values are encrypted/redacted according to capability and retention.

## View Audit Record pattern

Header shows action, record, outcome, exact time, actor/source, and scope. Body shows reason, approval, request context, and structured changes. Related links open the record/version/approval without losing audit filters.

## Compare Changes pattern

Use a semantic table with Field, Previous value, New value. Label additions/removals/changes in text. Preserve whitespace where meaningful. Collapse unchanged fields. For long documents, show version metadata and accessible diff summary before detail.

## Approve / Reject Action pattern

Show initiator, requested action, impact, amount/count/scope, policy threshold, evidence, conflicts, prior approvals, and expiry. Approve and Reject are distinct buttons. Reject requires reason. Recheck capability, separation of duties, context, and record version at submit.

## Require Reason / Justification

Reason is a concise structured category; justification is free text explaining exceptional context. Require both for overrides, corrections, archival, permission changes, refunds, write-offs, grade/attendance changes after closure, and policy exceptions. Never prefill justification that encourages rubber stamping.

## Sensitive actions

Archive student, change guardian link, alter closed attendance/grade, refund/write-off, grant role, export sensitive data, rotate integration credentials, change retention/policy. Confirmation names the record, scope, consequence, reversibility, notifications, and approval requirement.

## Domain examples

### Attendance

Actor: Noura Saleh. Previous: Absent. New: Excused. Reason: Medical evidence received. Approval: VP-APR-204. Source: Attendance resolution workspace.

### Grade

Actor: Academic Coordinator. Previous: 82. New: 86. Reason: Marking correction. Show assessment, student, term, evidence, teacher acknowledgement, and policy approval.

### Fee

Actor: Finance Officer requested JOD 150 write-off; School Owner approved. The posted adjustment links invoice, account, reason, evidence, and approval.

### Student profile

Legal name correction shows previous/new value, supporting document reference, registrar actor, school scope, and effective date. Unauthorized viewers see “Protected value changed.”

### Staff

Role grant shows actor, target, capability set, school/campus scope, start/expiry, approver, and reauthentication evidence. Payroll remains in separate protected scope.

## Approval flow

~~~mermaid
stateDiagram-v2
  Draft --> Submitted
  Submitted --> InReview
  InReview --> Approved
  InReview --> Rejected
  InReview --> ChangesRequested
  ChangesRequested --> Submitted
  Submitted --> Expired
  Approved --> Applied
  Applied --> Reversed: elevated correction
~~~

Notifications follow priority and sensitivity policy. Reading an approval does not acknowledge or resolve it. Delegation is explicit and expiring.

## Accessibility

Audit tables have captions/headers, diffs include text labels, filters are named, focus returns after dialogs, and live updates do not reorder unexpectedly. Exact timestamps are accessible; relative time supplements them. Keyboard and 200% zoom are mandatory.

## RTL considerations

Use logical layout. Keep previous/new columns labelled rather than relying on direction. Isolate IDs, timestamps, IP-like metadata, currency, and mixed values. Arabic reasons use governed terminology.

## English and Arabic examples

English: Reason for changing the closed attendance record. Arabic: سبب تعديل سجل الحضور المغلق.

English: This write-off requires School Owner approval and cannot be applied by the requester. Arabic: يتطلب هذا الشطب موافقة مالك المدرسة ولا يمكن لمقدم الطلب اعتماده.

## Do / Don’t

Do show actor, scope, exact time, source, diff, reason, and approval. Do protect values by field permission. Don’t permit edit/delete, use color-only diffs, expose credentials/tokens, accept generic “Other” without justification, or allow self-approval.

## Enterprise best practices

Use append-only event storage, tamper evidence, retention/legal hold, export watermarking, privileged-access review, separation of duties, anomaly alerts, and periodic access certification. Document jurisdiction-specific retention outside the component layer.

## Implementation notes

Audit generation occurs server-side in the same trusted transaction or durable event flow as the change. UI receives display-safe projections. Export is asynchronous, permission checked at generation and download, scoped, expiring, watermarked, and audited.

