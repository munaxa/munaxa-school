# Munaxa Permission Architecture

## Permission model

Permissions are evaluated as **role capability + resource scope + record state + explicit grant**. Deny wins. The server is authoritative; the interface reflects authorization but never replaces enforcement.

| Role | View | Create | Edit | Delete | Export | Approval |
|---|---|---|---|---|---|---|
| Super Admin | All tenants for support and governance, audited | Platform configuration and tenant provisioning | Platform and delegated tenant settings | Tenant lifecycle under retention policy | Cross-tenant operational reports, audited | Platform-critical changes |
| School Owner | All owned schools, campuses, operations, and finance | Schools, campuses, leadership access | Organization settings and delegated access | Organization records where policy permits | Owned-school operational and financial data | Finance exceptions, policy and access changes |
| Principal | Assigned school academic and operational data; summarized finance | School operations, programs, announcements | School policy, staffing assignments, student interventions | Limited operational records; never immutable finance history | Assigned-school academic and operational reports | Admissions decisions, student archival, attendance escalations |
| Vice Principal | Delegated academic and operational domains | Interventions, schedules, announcements | Delegated school operations | Limited delegated records | Delegated reports | Delegated admissions and attendance cases |
| Registrar | Student, guardian, enrollment, admissions, and documents | Applications, students, guardians, enrollments | Identity, enrollment, and admissions records | Draft/duplicate records; archival requires approval | Student and admissions reports within school | Enrollment completion; no elevated self-approval |
| Finance Officer | Billing, payments, balances, limited student identity | Invoices, payments, reminders, refunds-in-review | Billing details before settlement and classifications | Draft invoices only; settled records are immutable | Financial reports for assigned schools | Reconciliation; write-offs/refunds above threshold require approval |
| Teacher | Assigned classes, students, attendance, and learning operations; no finance | Attendance, class notes, messages to assigned groups | Own class records within open periods | Own drafts before submission | Assigned-class reports if policy allows | Submit attendance; cannot approve own exceptions |
| Parent | Own profile and linked children only | Requests, acknowledgements, messages, permitted payments | Own preferences and allowed child details | Own drafts/messages where permitted | Own-child statements and records | Consent and acknowledgement only |
| Student | Own profile, timetable, attendance summary, messages, permitted reports | Requests and permitted submissions | Own preferences and drafts | Own drafts where permitted | Own records if age/policy permits | Acknowledgement only |

Use capability names such as student:view, invoice:create, payment:refund, report:export, and admission:approve. Add school, campus, class, self, and linked-children scopes separately; do not encode scope into role names.

## Permission rules

### Visibility rules

- Teachers cannot view balances, invoices, payments, fee status, or finance exports.
- Parents may view only children linked through an active, verified guardian relationship.
- Students cannot access staff HR, payroll, disciplinary, private notes, or other students’ records.
- Finance officers receive the minimum student identity needed for billing.
- Cross-school views require organization-level capability and visible active-school context.
- Sensitive fields are filtered by the API, not hidden by CSS.

### Action rules

- Finance write-offs and policy-threshold refunds require a different authorized approver.
- Student archival requires elevated permission, a reason, confirmation, and an audit event.
- Submitted attendance is read-only unless a resolution workflow is opened.
- Settled payments and issued receipts are immutable; corrections use reversals.
- Role or scope changes require reauthentication and cannot be self-approved.
- Bulk actions evaluate every record and report partial failures.

### Data segmentation rules

- **Multi-school isolation:** every record carries tenant and school boundaries; scope derives from the authenticated session.
- **Multi-campus isolation:** campus staff see assigned campuses; leaders aggregate only when granted.
- **Class-level access:** teachers see students through current effective-dated class assignments.
- **Linked-child access:** guardian access is relationship-based, effective-dated, and revocable.
- **Field-level segmentation:** finance, health, safeguarding, and HR fields use separate capabilities.
- Caches, exports, search indexes, notifications, and audit logs preserve the same boundary.

## Permission UX pattern

### Layout

~~~text
Page context + active scope
Permission-aware actions
Content or read-only representation
Reason / approval state / request-access action
Audit metadata where appropriate
~~~

### Hidden versus disabled

Hide actions a user can never perform or whose presence exposes sensitive capabilities. Disable actions when access normally exists but record state, validation, or approval dependency prevents it. Explain every disabled action with nearby text or an accessible description.

### Permission errors, approvals, and read-only views

- Use inline feedback for one blocked action, a section boundary for unavailable content, and a 403 page only when the route is unauthorized.
- State what is unavailable, why at a safe level, and the available next step.
- Approval views show action, initiator, impact, reason, evidence, threshold, approvers, expiry, and audit history.
- Prevent self-approval where separation of duties applies; recheck authorization and record version on approval.
- Read-only views preserve information hierarchy, remove mutation affordances, and show a concise reason.

### Usage rules

- Resolve permission before rendering sensitive data.
- Keep scope visible in page headers, exports, and approval requests.
- Revalidate on submit and after role or scope changes.
- Design denied, expired, partially authorized, and approval-pending states.

### Do

- Use stable capability names and explicit scope.
- Explain recoverable restrictions.
- Audit sensitive views, exports, grants, and approvals.

### Don’t

- Treat hidden buttons as security.
- Infer permission from navigation visibility.
- Scatter direct role-name checks through component logic.
- Reveal data in counts, autocomplete, URLs, notifications, or exports.

### Accessibility

Permission messages use headings and programmatic status. Disabled controls remain understandable without hover. Approval queues support keyboard operation, clear focus, and non-color labels.

### RTL

Use logical start/end positioning. Isolate timestamps, identifiers, currency, and policy codes. Localize approval sequence layout without changing chronology.

