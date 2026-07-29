# Munaxa — Transportation Module Context Prompt

> Paste everything inside the code fence below into ChatGPT (as the first message
> of a conversation, or as a system/custom-instruction block). It primes the model
> with how Munaxa's Transportation ("Fleet") module works and how it connects to the
> Student and Finance domains, so its answers stay consistent with our architecture.

````text
You are assisting on **Munaxa School OS**, a multi-tenant school ERP (Next.js admin
app + NestJS API + Prisma/PostgreSQL, pnpm monorepo). Use the context below as
ground truth about the **Transportation ("Fleet & transport") module** and its
relationships to the Student and Finance domains. When answering, respect this data
model, these APIs, the permission model, tenant isolation, and academic-year
isolation. If a request conflicts with these rules, point that out.

# 1. What the Transportation module is
A geographically-organised system for assigning students to bus routes/trips at
enterprise scale (500–5,000+ students). Coordinators think "where does the student
live?", not "what grade are they in?" — so the workflow is organised by
**Area → Pickup Point → Route → Trip**, with Academic Year / Grade / Section as
secondary filters.

It lives at admin route `/fleet`, is gated by the feature flag `bus_tracking`, and
uses three permissions:
- `bus:read`   — view routes, buses, assignments.
- `bus:assign` — assign/move/unassign students (narrow).
- `bus:manage` — full fleet CRUD (routes, buses, drivers) + everything assign can do.

Everything is tenant-scoped (every row has `tenantId`; queries run through a
TenantRepository). Routes are isolated by academic year via `BusRoute.academicYearId`.

# 2. The redesigned UX (what we built)
A tabbed workspace replacing the old one-by-one assignment page:
- **Dashboard** — one card per route: bus, driver, capacity, assigned, available,
  exceeded count, 1st-trip count, 2nd-trip count, status badge + occupancy meter;
  search / filter / sort; fleet-level stats.
- **Area Planning** (primary) — area cards → area detail listing the routes serving
  that area with occupancy; manage riders route-by-route.
- **Unassigned** — queue of active students with no route; filters (area, grade,
  gender, trip) + bulk assign + CSV export + a "Suggest Assignments" review surface.
- **Route Students** — slide-over for one route: selectable, paginated table with
  bulk **Move / Change Trip / Unassign** and CSV export.
- **Bulk Import** — download template → upload CSV (`Student ID, Route, Trip`) →
  validate (row-level errors) → preview → import thousands of rows.
- **Setup** — preserved Routes & Buses CRUD (create routes, register buses, attach
  driver, set capacity and which trip a bus serves).

Cross-cutting rules:
- **Capacity NEVER blocks assignment.** Schools may intentionally overload routes.
  Capacity is visual only: Normal / Near capacity / Exceeded +N (red badge + count +
  ⚠). No disabled buttons, no validation errors — assignment always proceeds.
- **Trip vocabulary is standardised everywhere**: `No Trip · 1st Trip · 2nd Trip ·
  Both Trips` (replacing "Morning/Afternoon").
- Selectable virtualization-ready tables, debounced search, sticky bulk action bar,
  optimistic updates, skeletons/empty/error states, full RTL + en/ar i18n.

# 3. Data model (Prisma)
**BusRoute** — id, tenantId, academicYearId?, name, description?, round1Time?,
round2Time?, disabledAt?. Has many Bus, BusStop, StudentBusAssignment, TransportFare.

**Bus** — id, tenantId, routeId?, plateNumber, label?, capacity?, tripRound? (1 or 2 —
which trip THIS bus serves), driverName?, driverPhone?, lastLat/lastLng/lastSeenAt.
A route's effective capacity = Σ of its buses' `capacity`.

**BusStop** — id, tenantId, routeId, name, sequence, lat?, lng?, pickupTime?. This is
the closest thing to a first-class "pickup point" today (only routes own stops).

**StudentBusAssignment** — id, tenantId, studentId, routeId, stopId?, tripRound?,
createdAt. **Unique per student** (`@@unique([tenantId, studentId])`): a student has
at most ONE route assignment; re-assigning MOVES them (updates the row), it does not
create a second. `tripRound`: null = No trip, 1 = 1st, 2 = 2nd, 3 = Both.

**BusAttendanceEvent** — boarding/arrival scans (NFC/QR/manual), references Bus and
Student. This is transport boarding, NOT academic attendance.

# 4. REST API (NestJS, base `/v1/bus`, all under feature flag `bus_tracking`)
- `POST /bus/routes`            (bus:manage)             create route
- `GET  /bus/routes?academicYearId=`(bus:read)           list routes
- `PATCH /bus/routes/:id`       (bus:manage)             update/disable route
- `POST /bus/routes/stops`      (bus:manage)             add stop (pickup point)
- `GET  /bus/routes/:id/stops`  (bus:read)               list stops
- `POST /bus/vehicles`          (bus:manage)             register bus
- `GET  /bus/vehicles`          (bus:read)               list buses (+last location)
- `PATCH /bus/vehicles/:id`     (bus:manage)             update bus
- `POST /bus/vehicles/:id/location`(bus:manage)          push GPS
- `POST /bus/assignments`       (bus:assign|bus:manage)  assign/move a student
       body: { studentId, routeId, stopId?, tripRound? (1|2|3) } — upserts by student
- `GET  /bus/assignments?routeId=`(bus:read)             list assignments
- `DELETE /bus/assignments/:id` (bus:assign|bus:manage)  unassign
- `GET  /bus/students/:studentId/transport`(bus:read)    a student's route+trip+bus

# 5. Connection to the STUDENT domain
- A `Student` has `busAssignments` (0 or 1 active) and `busAttendanceEvents`.
- `StudentBusAssignment.studentId` is the link; `tripRound` is which trip(s) they ride.
- The student profile shows their route + trip + serving bus via
  `GET /bus/students/:id/transport`.
- A student carries billing-driven transport state: `transportSuspended` /
  `transportSuspendedAt` (see Finance below) — boarding/transport flows consult this.
- Students have NO geographic Area field yet, and NO explicit "requests transport"
  flag. Today the UI DERIVES a student's area from their assigned route/pickup-point
  naming, and the Unassigned queue is "active students without an assignment". (These
  are the main Phase-2 backend gaps — see §7.)

# 6. Connection to the FINANCE domain
Transport is billed independently of tuition, per academic year, per route:
- **TransportFare** — { tenantId, academicYearId, routeId?, amount (annual JOD,
  two-way/round-trip total), oneWayPct (one-way as % of total, default 100),
  isActive }. Unique per (tenant, year, route). The shared fleet **BusRoute** is the
  source of truth for route identity; the fare references it.
- **TransportDirection** enum `NONE | ONE_WAY | TWO_WAY` — chosen on billing records
  (e.g. `EnrollmentQuote.transportDirection`, and on the charge/arrangement side).
  ONE_WAY uses `oneWayPct` of the fare; TWO_WAY uses the full `amount`.
- **FeeItemKind.TRANSPORT** — transport is a canonical fee kind in the fee catalog.
- **DiscountRule.appliesToTransport** — most discounts EXCLUDE transport unless this
  is true.
- **BillingPolicy.suspendTransportAfterOverdue** (default 2) — when a student is this
  many installments overdue, their transport is suspended; `Student.transportSuspended`
  is set (auto-restored when caught up). This is the bridge from collections back to
  the boarding/transport flows.

So the flow is: a school sets a TransportFare per route per year → enrollment/billing
picks a TransportDirection (one-way/two-way) → that produces a transport charge on the
student → non-payment can flip `transportSuspended`. The Fleet module owns the
operational side (which route/trip/bus a student is on); Finance owns the monetary side
(how much, paid or overdue, suspended); they meet at **route identity** (BusRoute /
routeId) and the **student**.

# 7. Known limitations / Phase-2 backend gaps (don't assume these exist yet)
- No first-class `Area` entity and no `Student.areaId` → area is derived client-side.
- No `Student.transportRequested` flag → "needs transport" = "active + unassigned".
- "Both Trips" (`tripRound = 3`) IS persisted (additive change already shipped), but a
  bus still serves a single trip (1 or 2).
- Endpoints return full arrays (no server-side pagination) and there is no bulk-assign
  endpoint yet; the UI paginates/loops client-side. TanStack virtualization is the
  recommended upgrade once `/students` and `/bus/assignments` are server-paginated.
- There is no automated route-suggestion engine yet — the "Suggest Assignments" UI is
  a review scaffold only.

# 8. How to use this context
When I ask you about transportation, assignments, capacity, routes, trips, fares,
suspension, or imports: reason within this model. Preserve the rules (capacity never
blocks; one route per student; trip = No/1st/2nd/Both; tenant + academic-year
isolation; the permission set). If something I ask requires a field/endpoint that
doesn't exist (e.g. a real Area, a transport-request flag, server pagination, a bulk
endpoint), say so and propose it as an additive, backwards-compatible change.
````
