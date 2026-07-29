# Munaxa Demo — Architecture

## Goals

1. Look and behave **exactly** like Munaxa, reusing the design system verbatim.
2. Be **completely isolated** from production — no shared database, APIs, credentials or network.
3. Require **no database** and minimal infrastructure (a single Next.js process).
4. Make **every change temporary**, always resettable to a known baseline.
5. Be **login-protected** with admin-managed, time-boxed accounts.

## Standalone by design

The project lives in its own folder and is **not** part of the Munaxa pnpm workspace. It imports
nothing from `@school/*`. The pieces of Munaxa it needs — the Tailwind design tokens, `globals.css`
variables, the logo, the UI kit (`Button/Card/Badge/Input/Field/Table/Spinner`), the RBAC
roles/permissions, and a small i18n catalog — are **vendored** under `src/`. This is what lets the
folder be promoted to a separate `munaxademo` repository with zero coupling.

## Two layers

```
┌─ Access layer (tiny server, runtime memory) ───────────────────────────────┐
│  middleware.ts            verifies a signed httpOnly session cookie on every │
│                           request; redirects/blocks when missing/expired.    │
│  /api/auth/*              login / logout / session.                          │
│  /api/admin/accounts/*    CRUD demo accounts (admin only).                   │
│  lib/auth/accounts.ts     in-memory account store + login history (no DB).   │
└──────────────────────────────────────────────────────────────────────────────┘
┌─ Data layer (100% client / session) ───────────────────────────────────────┐
│  seed/*                   deterministic generators → immutable baseline.     │
│  lib/demo-store/context   a deep clone of the baseline in React state;       │
│                           all mutations touch only this in-memory copy.      │
│  lib/mock-integrations    email/SMS/WhatsApp/push/JoFotara/payments → stubs. │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Why a small server gate (not pure client)?

The brief requires the demo to be "not publicly accessible," with admin-managed accounts,
expiration enforcement and login history. A signed **httpOnly** cookie verified in `middleware.ts`
makes that real (it can't be bypassed by editing client state) — while still using **no database**.
The explorable school data stays entirely client-side, so it is fast and trivially resettable.

## Data generation

`seed/index.ts#buildBaseline()` uses a fixed-seed PRNG (`seed/prng.ts`) to deterministically
generate Munaxa Academy: KG–Grade 12, 500 students, 700 parents (siblings share parents), 50
teachers, 30 staff, sections, subjects, recent attendance, term grades, invoices/payments,
buses/routes/drivers, library books/loans, HR employees, events, announcements and notifications.

The baseline is **memoised and frozen by convention** — the app never writes back to it. A demo
session edits a **deep clone** (`cloneBaseline()`), so the source data can never be mutated.

> The dataset is built **on the client, after mount** (not during SSR). This keeps the heavy,
> clock-dependent generation off the server and eliminates hydration mismatches.

## Reset mechanism

| Trigger          | How it resets                                                                |
| ---------------- | ---------------------------------------------------------------------------- |
| **Logout**       | `/api/auth/logout` clears the cookie; the client clears persona + re-seeds.  |
| **Browser close**| The session cookie (no `maxAge`) and sessionStorage both vanish on close.     |
| **Session expiry**| The signed `exp` claim is rejected by `middleware.ts` → forced re-login.     |
| **Server restart**| The in-memory account/history store re-seeds; the client rebuilds baseline. |
| **On demand**    | The "Reset demo data" button in the banner re-clones the baseline instantly. |

Because edits live only in React runtime state (browser memory), a hard refresh also returns to
the baseline.

## Roles & navigation

`lib/rbac.ts` vendors the Munaxa role→permission matrix and defines eight personas. The shell
(`components/app-shell.tsx`) filters navigation by the active persona's permissions, so each role
sees a different dashboard, navigation and reports — exactly like production RBAC.

## Book a Demo funnel (controlled access)

There are no public credentials. Access is provisioned by the team:

```
Visitor → /request-demo (public form) → POST /api/requests
        → DemoRequest{status:NEW} (in-memory, lib/requests.ts)
   admin → /admin/requests : NEW → CONTACTED → SCHEDULED → APPROVED | REJECTED
        → "Create account" → POST /api/admin/accounts {role, expiresInDays, requestId}
        → DemoAccount provisioned (role-locked, expiring) + request → CONVERTED
   prospect → /login (provisioned creds) → opens directly in the assigned role
```

`/request-demo` and `POST /api/requests` are the only public surfaces besides `/login`. Demo
requests live in server memory (no DB) and reset on restart, like everything else. Provisioned
prospect accounts carry an **assigned role** (`DemoAccount.role`), so they enter directly in that
persona and the in-app role switcher is hidden (admins keep free switching).

## Folder map

```
munaxademo/
├─ middleware.ts                 # access gate
├─ src/app/
│  ├─ login/                     # account login + persona chooser
│  ├─ (app)/                     # authenticated area (server-guarded layout)
│  │  ├─ dashboard, admissions, students, attendance, academics, finance, hr,
│  │  ├─ transport, library, communication, events, reports, analytics,
│  │  ├─ portal/{parent,student,teacher}, admin/accounts
│  └─ api/{auth,admin}/...       # route handlers (Node runtime)
├─ src/components/               # vendored UI kit + shell, banner, onboarding
├─ src/lib/                      # auth, demo-store, mock-integrations, rbac, i18n
└─ src/seed/                     # deterministic dataset generators
```
