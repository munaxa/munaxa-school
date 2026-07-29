# Munaxa Domains

**Purpose:** the living design of each business area — its model, its rules, its seams.
**Audience:** engineers and architects working inside a domain.
**Authority:** binding for the domain it covers, subject to
[`../architecture/`](../architecture/README.md).

Each folder holds the current intended design of one bounded context. These are **living**
documents: when the design changes, they change. Dated reports of past programmes live in
[`../archive/`](../archive/README.md) instead.

Before adding a feature that spans two domains, read
[`../architecture/capability-ownership-matrix.md`](../architecture/capability-ownership-matrix.md)
— it records which module owns which capability and how they connect.

---

| Domain | Owns | Entry point |
| --- | --- | --- |
| **[hr/](./hr/README.md)** | Employees, org structure, contracts, documents, leave, payroll attendance, performance, training, assets, recruitment, self-service | [README](./hr/README.md) |
| **[finance/](./finance/)** | Fees, charges, invoices, payments, allocations, adjustments, collections, statements | [finance-domain-specification-v1.md](./finance/finance-domain-specification-v1.md) |
| **[attendance/](./attendance/)** | Student and teaching presence, registers, policies | [structure-ui.md](./attendance/structure-ui.md) |
| **[student-lifecycle/](./student-lifecycle/)** | Identity, admission, enrolment, placement, progression, exit | [architecture-review.md](./student-lifecycle/architecture-review.md) |
| **[enrollment/](./enrollment/)** | Registration, enrolment change and its billing consequences | [billing-impact.md](./enrollment/billing-impact.md) |
| **[transport/](./transport/)** | Fleet, routes, stops, areas, student assignment, driver duty | [redesign.md](./transport/redesign.md) |
| **[scheduling/](./scheduling/)** | Timetable engine, schedule plans, constraints | [engine-refactor.md](./scheduling/engine-refactor.md) |

## Domain boundaries

Munaxa is a **modular monolith**. Boundaries are enforced by convention and review, not by
network calls:

- A module owns its tables. Another module reads them **through the owning module's service**,
  never by querying them directly.
- A module never imports another module's repository. That is the boundary.
- Cross-module coupling is either an explicit service call (when the caller needs the result) or a
  domain event (when it does not). **If adding a new consumer would require editing the producer,
  use an event.**

Two areas deliberately share a name and must not be confused:

- **Attendance** exists twice: *student/teaching* attendance (`attendance/`, the academic
  register) and *staff/payroll* attendance ([`hr/attendance-enterprise-architecture.md`](./hr/attendance-enterprise-architecture.md)).
  They have separate permissions (`attendance:*` versus `staff-attendance:*`), separate tables and
  separate consumers. Never merge them.
- **Leave** exists twice: *student* leave in the parent portal and *staff* leave in HR
  (`staff-leave:*`). Same rule.

## Finance and enrolment

Finance and enrolment are tightly coupled by design — an enrolment decision has billing
consequences. The seam is documented from both sides:

- [enrollment/billing-impact.md](./enrollment/billing-impact.md) — what an enrolment change does
  to money.
- [finance/unified-financial-account-architecture.md](./finance/unified-financial-account-architecture.md)
  — the account model that receives it.

The canonical finance model is
[finance/finance-domain-specification-v1.md](./finance/finance-domain-specification-v1.md).
Where any other finance document disagrees with it, the specification wins.
