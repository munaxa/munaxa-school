# Munaxa Workflow Architecture

## Workflow contract

Each workflow is a versioned server-owned state machine. Transitions require capability and scope, validate the current version, write an audit event, and may emit notifications.

## Admissions workflow

**Goal:** convert a qualified inquiry into a valid enrollment with transparent decisions.

~~~mermaid
stateDiagram-v2
  Inquiry --> Application: start
  Application --> Review: submit
  Review --> Application: request changes
  Review --> Interview: shortlist
  Interview --> Decision: outcome
  Decision --> Enrollment: accept
  Decision --> Closed: decline / withdraw
  Enrollment --> Enrolled: activate
~~~

| State | Transition | Approval point | Notification | Recovery |
|---|---|---|---|---|
| Inquiry | Start/close | None | Acknowledgement | Reopen if policy allows |
| Application | Submit/withdraw | Guardian attestation | Submission receipt | Return to retained draft |
| Review | Changes/shortlist/reject | Registrar completeness | Missing-information reminder | Reassign reviewer |
| Interview | Complete/reschedule/no-show | Panel outcome | Schedule/reminder | Reschedule with reason |
| Decision | Accept/decline/waitlist | Principal/delegate | Private decision notice | Elevated reopen |
| Enrollment | Complete/cancel | Registrar verification | Confirmation | Unresolved checklist |

Badges: Inquiry neutral, Application info, Review warning, Interview primary, Decision warning, Enrolled success, Declined/Withdrawn neutral. Show current stage, owner, age, next action, requirements, and history; never expose internal review notes.

## Attendance resolution workflow

**Goal:** produce an accurate register and resolve exceptions with guardian communication.

~~~mermaid
stateDiagram-v2
  [*] --> Present
  Present --> Late
  Present --> Absent
  Late --> Excused
  Absent --> Excused
  Late --> GuardianNotification
  Absent --> GuardianNotification
  GuardianNotification --> Resolution
  Resolution --> Closure
  Resolution --> GuardianNotification
~~~

Submitted changes require a reason and preserve prior values. Escalate repeated absence, safeguarding flags, failed delivery, or no response by policy. Handle transport mismatch, late data, duplicate registers, unknown students, and offline conflicts. Recovery supports draft restoration, conflict comparison, retry, and authorized correction.

## Fee collection workflow

~~~mermaid
stateDiagram-v2
  Invoice --> Reminder
  Invoice --> Payment
  Reminder --> Payment
  Payment --> Settlement
  Payment --> Failed
  Failed --> Payment
  Settlement --> Receipt
  Settlement --> RefundReview
  Invoice --> WriteOffReview
~~~

**Goal:** collect and reconcile fees with an immutable trail. Partial payments retain the open invoice. Failed attempts preserve safe retry context. Refunds reference the original payment and require threshold approval. Write-offs require separation of duties and never delete history. Idempotency prevents duplicates; reconciliation handles provider delay.

## Transport workflow

~~~mermaid
stateDiagram-v2
  Route --> Assignment
  Assignment --> Boarding
  Boarding --> Trip
  Trip --> DropOff
  DropOff --> Closed
  Boarding --> Exception
  Trip --> Exception
  Exception --> Trip
  Exception --> Closed
~~~

**Goal:** safely assign riders and track boarding through verified drop-off. Boarding consumes attendance context but never silently rewrites the school register. Handle unassigned riders, wrong buses, missed boarding, unauthorized pickup, breakdown, delay, and offline scans. Safety exceptions escalate until acknowledged.

## Communication workflow

~~~mermaid
stateDiagram-v2
  Draft --> Review
  Review --> Draft
  Review --> Publish
  Publish --> Deliver
  Deliver --> Read
  Deliver --> Failed
  Failed --> Deliver
  Read --> Archive
  Deliver --> Archive
~~~

**Goal:** deliver governed communication to the correct audience and channel. Channel selection respects urgency, consent, verified contacts, quiet hours, cost, and sensitivity. Whole-school, emergency, policy, and regulated messages require approval. Recovery includes draft history, retry, fallback, pre-send cancellation, and recipient-level status.

## Shared transition rules

Every workflow documents goal, states, valid transitions, approval points, notifications, and recovery. Transitions emit domain events rather than direct UI effects. Errors retain input, expose a reference ID, and distinguish validation, authorization, conflict, provider, and system failure.

