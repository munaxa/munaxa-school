# Action Panel Pattern

## Purpose

The Action Panel presents valid transitions for the active record and state. It is context-aware, permission-filtered, compact, and secondary to record understanding.

## Action hierarchy

- Primary: one action that advances the current task.
- Secondary: common reversible actions such as message, assign, or export.
- Dangerous: archive, cancel, reverse, revoke; separated visually and confirmed.
- Approval: request, approve, reject, reassign; show impact, policy, and evidence.

## Permission rules

Hide actions a user can never perform. Disable temporarily unavailable actions with a visible reason. Revalidate capability, scope, workflow state, and record version on submit. Prevent self-approval where separation of duties applies.

## Examples

Student: Edit profile, Message guardian, Request archival. Finance: Record payment, Send reminder, Request write-off. Communication: Submit for review, Publish, Cancel scheduled delivery.

## Accessibility and RTL

Use real buttons, unique accessible names, predictable focus, status announcement, and confirmation focus return. Never require hover. Use logical ordering; dangerous actions remain last in reading order.

