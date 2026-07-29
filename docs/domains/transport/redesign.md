# Transportation Module — UX & Architecture Redesign

> Status: design + Phase‑1 production implementation (frontend, existing APIs).
> Scope: workflow and information‑architecture redesign of the Transportation
> ("Fleet & transport") module for enterprise‑scale schools (500 → 5,000+ students),
> preserving existing APIs, permissions, audit logs, tenant isolation, academic‑year
> isolation, and the Munaxa design system.

---

## 1. Current‑state analysis

### 1.1 Where it lives

| Layer | Location |
| --- | --- |
| Admin UI | `apps/admin/src/app/(app)/fleet/page.tsx` (single 856‑line client page) |
| Admin API client | `apps/admin/src/lib/bus.ts` |
| Backend module | `apps/api/src/advanced/bus/` (`controller`, `service`, `repository`, `dto`) |
| Data model | `prisma/schema.prisma` → `BusRoute`, `Bus`, `BusStop`, `StudentBusAssignment` |
| Feature flag | `bus_tracking` (gated by `FeatureFlagGuard` + `RequireFeature`) |
| Permissions | `bus:read`, `bus:assign`, `bus:manage` |
| i18n | `packages/i18n/src/locales/{en,ar}.json` → `fleet.*`, `nav.fleet` |

### 1.2 Data model (as built)

```
BusRoute (id, tenantId, academicYearId?, name, description?, round1Time?, round2Time?, disabledAt?)
  └─ Bus[]              (id, plateNumber, routeId?, label?, capacity?, tripRound? 1|2, driver…, lastLat/Lng)
  └─ BusStop[]          (id, routeId, name, sequence, lat?, lng?, pickupTime?)   ← closest thing to a "pickup point"
  └─ StudentBusAssignment[]  @@unique([tenantId, studentId])  (studentId, routeId, stopId?, tripRound? 1|2)
```

Key facts that constrain the redesign:

- **One assignment per student** — `@@unique([tenantId, studentId])`; re‑assigning *moves* the student (the repository updates the existing row). Bulk "move" is therefore just bulk "assign".
- **`tripRound` is `Int?` constrained to `1 | 2`** (`@IsIn([1, 2])` in both `AssignStudentDto` and `CreateBusDto`). There is **no representation for "Both Trips"** and `null` doubles as both "No trip" and "not yet chosen".
- **Capacity lives on `Bus`, not `BusRoute`.** A route's effective capacity = Σ capacities of the buses assigned to it. There is no per‑route capacity field.
- **No geographic dimension exists.** `Student` has no address / area. `BusStop` has a free‑text `name` and optional lat/lng — it is the only spatial anchor, and only routes (not students) own stops.
- **No "requests transport" signal.** Nothing marks a student as *wanting* transport; the only states are "has an assignment" or "doesn't".
- Tenant isolation is enforced in `TenantRepository.run((tx, tenantId) => …)`; academic‑year isolation is via `BusRoute.academicYearId`.

### 1.3 Current workflow

`/fleet` renders three cards on one page:

1. **Routes** — create/edit/disable routes (grouped by academic year).
2. **Buses** — register buses, attach to a current‑year route, set trip 1/2, capacity, driver.
3. **Route detail** — pick one route from a `<Select>`, then **assign students one at a time** via an `EntityPicker` (`loadStudentOptions` loads *all* students into a client dropdown), choose trip, click **Assign**. Assigned students render as an unpaginated `<ul>`.

---

## 2. UX problems identified

| # | Problem | Impact at scale |
| --- | --- | --- |
| P1 | **One‑by‑one assignment.** Pick route → search student → pick trip → Assign, repeated per student. | 1,000 students = 1,000 manual cycles. Unusable. |
| P2 | **`loadStudentOptions` loads every student** into a single client‑side dropdown with no pagination/virtualization. | DOM + memory blow‑up at 5,000 students; slow first paint. |
| P3 | **No "who still needs a bus?" view.** Coordinators cannot see the queue of unassigned riders; they must already know each name. | No way to drive the backlog to zero. |
| P4 | **Organized by academic year, not geography.** The mental model is "what grade?" not "where do they live?" — the opposite of how transport is planned. | Planning is indirect and error‑prone. |
| P5 | **Capacity is invisible and unmanaged.** No assigned/available/over‑capacity signal anywhere; nothing warns or visualizes load. | Overloads/empty seats go unnoticed. |
| P6 | **No bulk anything** — no multi‑select, no bulk move/unassign/change‑trip, no import/export. | Re‑routing a neighborhood = hundreds of clicks. |
| P7 | **Assigned list is an unpaginated `<ul>`** with no search, sort, columns, or selection. | Hundreds of `<li>` per route; no way to act on a subset. |
| P8 | **Trip vocabulary is "1st/2nd" only**, `null` overloaded, no "Both Trips". | Round‑trip riders cannot be expressed. |
| P9 | **No dashboard / occupancy overview.** Routes are a flat grouped list; no per‑route stats. | No fleet‑level situational awareness. |

---

## 3. Proposed information architecture

The module is reorganised around the **geographic** mental model. Academic Year /
Grade / Section become *secondary filters*, never the primary axis.

```
Transportation  (route: /fleet — feature flag bus_tracking, perm bus:read)
│
├── Dashboard            Route cards, occupancy, capacity status, fleet stats
├── Area Planning  ★     PRIMARY workflow — geographic. Area cards → area detail →
│                         routes serving the area + assign unassigned riders in context
├── Unassigned           Queue of riders needing a route; filters + bulk assign
├── Route Students       Opened from a route (Dashboard/Area) → bulk move/unassign/change‑trip
├── Bulk Import          Template → upload → validate → preview → import (Student ID | Route | Trip)
└── Setup                Existing Routes & Buses CRUD (preserved)
```

★ Area Planning is the landing intent for coordinators; Dashboard is the landing
intent for managers. Both are first‑class tabs.

### 3.1 Trip terminology (everywhere)

`No Trip · 1st Trip · 2nd Trip · Both Trips`. Single source of truth in
`fleet/lib.ts` (`TRIP_OPTIONS`, `tripLabel`, `tripMatches`). "Morning/Afternoon"
is fully removed from copy.

### 3.2 Capacity model (never blocks)

Per route: `capacity = Σ bus.capacity`, `assigned = count(assignments)`,
`available = max(capacity − assigned, 0)`, `exceeded = max(assigned − capacity, 0)`.

| Condition | Status | Treatment |
| --- | --- | --- |
| `assigned < capacity` | **Normal** | muted / success badge |
| `assigned === capacity` (and capacity>0) | **Near capacity** | warning badge |
| `assigned > capacity` | **Exceeded +N** | danger badge, red count, warning icon |

Assignments are **always allowed**. No disabled buttons, no validation errors —
visual warnings only. (Implemented in `capacityStatus()`.)

---

## 4. User flows

**F1 — Reassign a neighborhood (the headline flow).**
Area Planning → pick *Khalda* → see its routes + the unassigned riders in that area →
select 40 students → **Assign to Route A / Both Trips** → optimistic update, toast,
counts refresh. (One pass instead of 40 cycles.)

**F2 — Clear the backlog.** Unassigned tab → filter Area=Dabouq, Trip=Both →
select‑all (header checkbox, page‑aware) → sticky bar **Assign** → choose route/trip → done.

**F3 — Rebalance an overloaded route.** Dashboard → Route B shows **Exceeded +7** →
Manage Route → Route Students → select 7 → **Move** → Route C.

**F4 — Onboard a new term.** Bulk Import → Download template → fill `Student ID | Route | Trip`
→ Upload → Validate (row‑level errors) → Preview → Import thousands.

**F5 — Change trip for a group.** Route Students → select riders → **Change Trip → Both Trips**.

**F6 — Future auto‑assign.** Any context → **Suggest Assignments** → review proposed
route/trip per student in a dialog → **Apply** (UX + component contract ready; no
backend intelligence yet).

---

## 5. Wireframe structure

```
┌ Transportation ───────────────────────────────── [routes] [buses] badges ┐
│ Tabs:  Dashboard | Area Planning | Unassigned | Bulk Import | Setup        │
├───────────────────────────────────────────────────────────────────────────┤
│ DASHBOARD                                                                   │
│  [search] [filter ▾] [sort ▾]          Stats: routes · seats · over‑cap     │
│  ┌ Route A ───────┐ ┌ Route B ───────┐ ┌ Route C ───────┐                  │
│  │ Bus 12 · Ahmad │ │ Exceeded +7  ⚠ │ │ …              │  ← occupancy bar │
│  │ ▇▇▇▇▇░ 43/50   │ │ ▇▇▇▇▇▇ 57/50   │ │                │                  │
│  │ 1st 38 · 2nd 35│ │ [Manage Route] │ │                │                  │
│  │ [Manage Route] │ └────────────────┘ └────────────────┘                  │
├───────────────────────────────────────────────────────────────────────────┤
│ AREA PLANNING                                                               │
│  ┌ Khalda 73 ┐ ┌ Dabouq 41 ┐ ┌ Abdoun 58 ┐ …   → Area detail:              │
│                                              routes+capacity, riders, [Assign]│
├───────────────────────────────────────────────────────────────────────────┤
│ UNASSIGNED / ROUTE STUDENTS  (virtualizable table)                          │
│  [search] [Area][Route][Status][Year][Grade][Section][Gender][Trip]         │
│  ☑ Name            ID     Grade  Area     Pickup   Trip      [Date]          │
│  ☑ Ahmed …                                                                  │
│  …                                          ┌ sticky ───────────────────┐   │
│                                              │ 45 selected  [Assign][Move]│   │
│                                              │ [Unassign][Change][Export] │   │
│                                              └────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

Responsive: **desktop** multi‑column cards + full table; **tablet** collapsible
filter panel; **mobile** route/area cards first, tables open inside a `Drawer`.

---

## 6. Component hierarchy

```
fleet/page.tsx                       Shell + Tabs workspace, shared data via useTransport()
├─ fleet/lib.ts                      types, trip helpers, capacityStatus, deriveArea, useTransport()
├─ fleet/components.tsx              CapacityMeter, RouteStatusBadge, TripBadge,
│                                    BulkActionBar (sticky), AssignDialog, ConfirmDialog,
│                                    SuggestAssignmentsDialog (scaffold), TableSkeleton
├─ fleet/dashboard.tsx               RouteDashboard → RouteCard[]
├─ fleet/areas.tsx                   AreaPlanning → AreaCard[] → AreaDetail
├─ fleet/unassigned.tsx             UnassignedStudents (filters + StudentTable + bulk)
├─ fleet/route-students.tsx          RouteStudentsDrawer (filters + StudentTable + bulk)
├─ fleet/student-table.tsx           Reusable selectable/paginated table (virtualization‑ready)
├─ fleet/bulk-import.tsx             BulkImport (template, parse, validate, preview, import)
└─ fleet/setup.tsx                   RoutesCard + BusesCard (existing CRUD, preserved)
```

Selection state (`Set<studentId>`) is owned by each table host and surfaced to the
shared `BulkActionBar`; actions call existing `busApi` mutations.

---

## 7. Frontend implementation plan (Phase 1 — this change)

1. **Preserve** `busApi` and the backend untouched; reuse `listRoutes`, `listBuses`,
   `listAssignments`, `assign`, `unassign`, `studentsApi.list`, sections/years.
2. **`useTransport()`** loads routes + buses + assignments (all routes) + students +
   sections once, derives per‑route view models (capacity/assigned/available/exceeded/
   trip counts/status), area buckets, and the unassigned set. Optimistic local updates
   on assign/unassign keep the UI snappy.
3. **Capacity & trip helpers** centralised; capacity **warns, never blocks**.
4. **Selectable table** with header (page‑aware) select‑all, debounced search,
   client‑side pagination via the existing `Pagination` component. Marked
   virtualization‑ready (see §11) so a `@tanstack/react-virtual` body is a drop‑in.
5. **Bulk actions** (assign/move/change‑trip/unassign/export CSV) run sequentially
   with optimistic UI + a single summary toast; errors surfaced per‑batch.
6. **Bulk Import** parses CSV client‑side (`Student ID, Route, Trip`), validates against
   loaded students/routes, shows a preview with row errors, then imports via `assign`.
7. **Suggest Assignments**: dialog + props contract rendered, returns a (currently
   empty / heuristic‑free) proposal list the admin reviews before applying — no backend.
8. **i18n**: new `transport.*` namespace added to `en.json` and `ar.json`; existing
   `fleet.*` kept. Full RTL via logical properties already used in the codebase.
9. **A11y**: dialogs/drawers from `@school/ui` are labelled + Esc‑closable; checkboxes
   use associated labels; action bar is keyboard reachable; status conveyed by text +
   colour (not colour alone).

---

## 8. Backend impact assessment

**Phase 1 (this change): one minimal additive backend change.** The only backend edit is
relaxing `AssignStudentDto.tripRound` validation from `@IsIn([1,2])` to `@IsIn([1,2,3])`
so **Both Trips** (value `3`) persists — additive and backwards‑compatible (existing
1/2/null rows stay valid; the column type is unchanged). Everything else uses existing endpoints
and permissions (`bus:read` to view, `bus:assign`/`bus:manage` to mutate). Tenant and
academic‑year isolation are unchanged because every call still goes through `busApi`/
`studentsApi` and `TenantRepository`. Audit logging (wherever the platform records
mutations) is preserved because the same mutation endpoints are used.

**Gaps that need backend work to make every spec item *fully* data‑driven (Phase 2):**

| Spec need | Gap today | Recommended additive change | Risk |
| --- | --- | --- | --- |
| **Both Trips** persisted | `tripRound` ∈ {1,2} | Allow `3` = Both in `AssignStudentDto` (`@IsIn([1,2,3])`); add label mapping. Backwards‑compatible. | Low |
| **Geographic Area** on students | none | `Area` model (`id, tenantId, name`) + `Student.areaId?` (or `transportArea String?`); expose in students list/filter. | Med |
| **"Requests transport"** queue | none | `Student.transportRequested Boolean @default(false)` (or derive from an enrollment add‑on/fee). Gates the Unassigned queue precisely. | Low |
| **Pickup point** as first‑class | `BusStop` exists but only routes own stops; students link a stop only via assignment | Optionally `Area.pickupPoints` / `Student.pickupPointId?`. | Med |
| **Per‑route capacity** | capacity only on `Bus` | Optional `BusRoute.capacity?` override; otherwise keep Σ(bus). | Low |
| **Server‑side pagination/search** for students & assignments | endpoints return full arrays | Add `?page&pageSize&search&routeId&unassigned&areaId` to `/students` and `/bus/assignments`. Enables true 5,000+ scale. | Med |
| **Bulk assign** endpoint | only single `POST /bus/assignments` | `POST /bus/assignments/bulk` (array) for one round‑trip + one audit entry. | Low |

Until Phase 2, Phase‑1 handles these client‑side: areas are **derived** (§9 of code:
`deriveArea` maps route/pickup naming to the area list, with an *Unzoned* bucket), the
unassigned queue is "active students without an assignment", and "Both Trips" is a
first‑class **filter/label** while the assign action persists what the API accepts.

## 9. Migration strategy

1. **No data migration in Phase 1.** The new UI reads the same tables; existing routes,
   buses, stops and assignments render immediately. The old single‑page CRUD is preserved
   as the **Setup** tab, so nothing administrators rely on disappears.
2. **Route stays `/fleet`** and the nav entry, permission (`bus:read`) and feature flag
   (`bus_tracking`) are unchanged — no nav migration, no broken links, no RBAC changes.
3. **Phase 2 (when backend lands):** additive migrations only —
   - `ALTER TABLE "Student" ADD COLUMN "areaId" uuid NULL`, `"transportRequested" boolean NOT NULL DEFAULT false`;
   - `CREATE TABLE "Area" …`; backfill `transportRequested=true` for students with a fee/enrollment add‑on or an existing assignment;
   - relax `tripRound` validation to `{1,2,3}` (no column change; existing rows valid).
   Each is backwards‑compatible; the frontend swaps `deriveArea` for the real `areaId`
   and the queue filter for `transportRequested` behind the same component props.
4. **Rollback:** Phase 1 is a pure frontend swap on one route — revert the commit. Phase 2
   columns are nullable/defaulted and safe to leave in place if the UI is rolled back.

---

## 10. Performance posture

- One batched load up front, then optimistic local mutation (no refetch storms).
- Debounced (250 ms) search, client pagination today; the table is structured so a
  `@tanstack/react-table` + `@tanstack/react-virtual` body is a localized upgrade
  (see §11) once `/students` supports server‑side pagination.
- Recommended Phase‑2 stack: **TanStack Table + TanStack Virtual** + server‑side
  pagination + the bulk endpoint, which together carry 5,000+ riders comfortably.

## 11. Why not TanStack now

Adding `@tanstack/*` requires new workspace dependencies + lockfile changes in a pnpm
monorepo, and true virtualization only pays off against a **server‑paginated** endpoint
(absent today). Phase 1 ships the full workflow on the existing client arrays with
pagination and a virtualization‑ready table contract; Phase 2 introduces the dependency
together with the server‑side endpoints that make it worthwhile. This is the "or
equivalent" path the brief allows, without risking the build or shipping a half‑wired dep.
