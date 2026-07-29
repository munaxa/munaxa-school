# Munaxa Notification Architecture

## Categories

| Category | Purpose | Example |
|---|---|---|
| Success | Confirm completed action | Attendance register submitted |
| Warning | Signal risk | Attendance approaching threshold |
| Error | Explain failure and recovery | Payment failed |
| Info | Provide non-urgent context | Report is generating |
| Approval Required | Request a governed decision | Write-off awaiting approval |
| System Alert | Communicate service or policy state | Tracking unavailable |
| Reminder | Prompt a time-bound task | Documents due |
| Escalation | Raise an unresolved high-impact item | Guardian not reached |

## Delivery channels

| Channel | Use when | Avoid when |
|---|---|---|
| Toast | Immediate current-action feedback with no later retrieval | Critical, long, or durable actions |
| Banner | Page/product scope affects the current task | Per-record updates |
| Inbox | Durable, actionable, user-specific work | Immediate validation |
| Email | External reach, summaries, receipts, links back | Sensitive detail in the body |
| Push | Timely mobile awareness with safe preview | Non-urgent bulk updates |
| SMS | Urgent verified fallback under consent/cost policy | Rich or sensitive content |
| In-app activity feed | Auditable record/team history | Urgent interruption |

A single event can create one durable inbox item plus selected delivery attempts; never create duplicate tasks per channel.

## Priority matrix

| Priority | Display | Escalation | Expiration |
|---|---|---|---|
| Low | Feed or digest | None | Archive by retention |
| Medium | Inbox; optional email/push | Reminder if time-bound | Resolve/archive with task |
| High | Inbox plus banner or push/email | Escalate after SLA | Never silently expire unresolved |
| Critical | Persistent alert plus approved urgent channels | Repeat through duty chain until acknowledged | Explicit resolution only |

Priority derives from impact, urgency, audience, and recoverability—not category alone.

## Notification object

Each notification has event ID, category, priority, safe title/body, actor, recipient and scope, entity link, primary action, timestamps, read/acknowledged/resolved state, localization key, channel attempts, deduplication key, and audit metadata.

## UX rules

### Do

- State what happened, affected scope, required action, and deadline.
- Keep one primary action and a safe destination.
- Group duplicates and summarize bulk outcomes.
- Distinguish read, acknowledged, and resolved.
- Respect locale, timezone, quiet hours, consent, and verified channels.
- Retry failed recipients without resending successful deliveries.

### Don’t

- Use success toasts as the only durable receipt.
- Put student, finance, health, or safeguarding detail in lock-screen previews.
- Use urgent without policy criteria.
- Repeat identical alerts across every channel.
- Clear critical notifications merely because they were read.

### Accessibility

Toasts use a polite live region; current-action errors may use assertive announcement sparingly. Persistent alerts have headings, text labels, keyboard actions, and never rely on color, sound, or motion. Avoid stealing focus.

### RTL

Use logical alignment and direction-aware action placement. Isolate identifiers, amounts, phone numbers, and timestamps. Localize pluralization, dates, and ordering rather than concatenating translated fragments.

## Examples

- **Success / toast:** Attendance submitted for Grade 8A. Action: View register.
- **Approval / inbox + email:** Write-off FIN-2041 needs approval by 16:00. Action: Review.
- **Critical / alert + push/SMS:** Bus 12 reported a safety exception. Action: Open incident.
- **Reminder / inbox:** Three application documents are due tomorrow. Action: View checklist.

