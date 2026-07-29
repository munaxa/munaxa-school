# DESIGN_SYSTEM_DISCOVERY.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration
**Phase:** 0 — Design System Discovery
**Date:** 2026-06-18
**Branch:** `claude/affectionate-shannon-fbfeaf`
**Status:** ✅ Complete — awaiting approval before Phase 1

> This is a **discovery report only**. No application code, tokens, components, schemas, APIs, or routes have been modified.

---

## 1. Executive Summary

The repository contains **two parallel, _disconnected_ design systems**:

1. **The reference design system** — `munaxadesignsystem/` — a rich, standalone shadcn/Radix + Tailwind v4 application: **53 UI primitives, 40+ documented domain components, a full token layer (colors, spacing, radius, shadows, typography, z-index, motion), 13 documented patterns/templates, and 27 governance documents.** This is the **source of truth** the program mandates compliance with.

2. **The live application** — `apps/admin/` (Next.js 15 + Tailwind v3) — which consumes **none** of the reference system. It uses a much thinner, independently-authored token preset (`@school/config-tailwind`), a utility-only UI package (`@school/ui`, which exports only `cn()`), and **8 hand-rolled local UI primitives**.

**The brand spine is aligned** (violet primary `#7A3FFF` is identical in both), and the app is already in good shape on the fundamentals the program cares about most: **zero hardcoded colors in component code, centralized tokens, working dark mode, RTL, and EN/AR i18n.**

**The core migration challenge is therefore _not_ "rip out hardcoded values"** — it is **reconciling the two systems**: deciding how the reference system's tokens, components, domain components, and patterns become consumable by the live app, then migrating pages onto them without changing business logic, APIs, schemas, or routes.

---

## 2. Repository Structure

```
Munaxa/
├── apps/
│   ├── admin/          ← LIVE FRONTEND (Next.js 15, React 19, Tailwind v3)  ← migration target
│   ├── api/            ← Backend (out of scope: no logic/schema/API changes)
│   └── mobile/         ← Mobile app (not in pnpm-workspace; out of scope)
├── packages/
│   ├── ui/             ← @school/ui  — currently exports ONLY cn()  ← key gap
│   ├── config-tailwind/← @school/config-tailwind — the tokens the app ACTUALLY uses
│   ├── i18n/           ← @school/i18n — EN + AR (641 keys each), RTL aware
│   ├── domain/         ← Locale types, constants
│   ├── contracts/      ← API type contracts
│   ├── config-eslint/  ├ tooling
│   └── config-typescript/
├── munaxadesignsystem/ ← REFERENCE DESIGN SYSTEM (standalone, NOT consumed by the app)
├── munaxademo/         ← demo (not in workspace)
├── munaxalanding/      ← marketing site (not in workspace)
├── prisma/             ← DB schema (out of scope)
└── docs/, infra/, scripts/
```

**pnpm workspace** includes only: `apps/api`, `apps/admin`, `packages/*`.
`munaxadesignsystem`, `munaxademo`, and `munaxalanding` are **outside the workspace** — the reference design system is not currently a buildable dependency of the app.

---

## 3. The Reference Design System (`munaxadesignsystem/`)

**Identity:** package `munaxa-design-system` v1.0.0 — a standalone Vite SPA + Express server, **not** published as a consumable npm package.

**Tech:** React 19, wouter (router), **Tailwind v4** (`@tailwindcss/vite`), Radix UI, shadcn/ui, lucide-react, framer-motion, recharts, sonner, cmdk.

### 3.1 Tokens — `client/src/design-system/tokens/`
TypeScript constant objects, surfaced to Tailwind v4 via `@theme inline` CSS variables.

| Category | Tokens |
|---|---|
| **Colors** (`colors.ts`) | Brand primary `#7A3FFF`, hover `#652ED8`, soft `#F5F0FF`; neutral `0`(#FFFFFF)→`950`(#0B1020); semantic `success #10B981`, `warning #F59E0B`, `danger #EF4444`, `info #3B82F6`; 5-stop purple data-viz palette |
| **Spacing** (`spacing.ts`) | 12-step scale: 0,1(.25rem),2,3,4,5,6,8,10,12,16,24 |
| **Radius** (`radius.ts`) | none, sm(.25), md(.375), lg(.5), xl(.75), full |
| **Shadows** (`shadows.ts`) | none, sm, md, lg, focus (3px @ 28% brand) |
| **Typography** (`typography.ts`) | **IBM Plex Sans** + **IBM Plex Sans Arabic** + mono; sizes xs→4xl; weights 400/500/600/700; line-heights tight/normal/relaxed |
| **Z-index** (`zIndex.ts`) | base 0, sticky 10, dropdown 20, overlay 30, modal 40, toast 50 |
| **Motion** (`motion.ts`) | durations instant/fast(120)/normal(200)/slow(300); standard/enter/exit easings |

### 3.2 Core Components — `client/src/components/ui/` (53 files)
Sidebar, Breadcrumb, Card, Input, Textarea, Select, Checkbox, RadioGroup, Toggle/ToggleGroup, Switch, Label, Button, ButtonGroup, DropdownMenu, ContextMenu, Menubar, Dialog, AlertDialog, Drawer, Sheet, Popover, HoverCard, Table, Pagination, Avatar, Badge, Separator, ScrollArea, Progress, Slider, Tabs, Accordion, Collapsible, NavigationMenu, Command, InputGroup, InputOTP, Calendar, Toast (sonner), Spinner, Skeleton, Alert, Empty, Carousel, AspectRatio, Resizable, Chart, KBD, Tooltip, Field, Item.

### 3.3 Domain Components — `design-system/components/school/` (40+)
- **Students:** StudentCard, StudentAvatar, StudentBadge, StudentTimeline, StudentStatus, GuardianSummary, EnrollmentStatus
- **Attendance:** AttendanceCard, AttendanceSummary, AttendanceStatus, AttendanceTimeline, AttendanceRiskIndicator, ClassAttendanceWidget
- **Finance:** BalanceCard, InvoiceCard, PaymentCard, FeeStatusCard, CollectionSummary, AgingCard
- **Transport:** BusCard, RouteCard, DriverCard, TransportStatus, BoardingStatus
- **Communication:** AnnouncementCard, NotificationCard, ConversationCard, MessageStatus, DeliveryStatus
- **Reporting:** ReportCard, ReportMetric, ReportFilterBar, ExportStatus

### 3.4 Patterns & Templates — `design-system/patterns/` & `templates/`
13 patterns: Dashboard, CRUD, Student Profile, Attendance, Finance, Reports, Settings, Empty/Loading/Error states, Workspace, Approval, Search. Templates: Dashboard base + Attendance/Finance/Principal/Reports/Teacher dashboards.

### 3.5 Governance Docs (27 `.md` at `munaxadesignsystem/` root)
DESIGN_GOVERNANCE, WORKSPACE_ARCHITECTURE, RECORD_PATTERNS, SEARCH_UX_ARCHITECTURE, PERMISSION_ARCHITECTURE, AUDIT_COMPLIANCE_UX, AUDIT_TRAIL_PATTERN, ACTIVITY_FEED_PATTERN, TIMELINE_PATTERN, RELATED_RECORDS_PATTERN, ACTION_PANEL_PATTERN, UNIVERSAL_SEARCH_PATTERN, WORKFLOW_ARCHITECTURE, NOTIFICATION_ARCHITECTURE, MULTI_TENANT_UX_ARCHITECTURE, DOMAIN_ARCHITECTURE, DOMAIN_COMPONENTS, DOMAIN_RELATIONSHIPS, DOMAIN_AI_GUIDELINES, AI_GENERATION_RULES, CONTENT_DESIGN_SYSTEM, DATA_VISUALIZATION_SYSTEM, ENTERPRISE_NAVIGATION, ENTERPRISE_DOCUMENTATION_ARCHITECTURE, PRODUCT_ARCHITECTURE_GUIDELINES, DESIGN_SYSTEM_ROADMAP, DESIGN_SYSTEM_AUDIT.

---

## 4. The Live Application (`apps/admin/`)

**Tech:** Next.js 15.1.4 (App Router, `typedRoutes`, `standalone` output), React 19, **Tailwind v3.4**, React Context for state (I18n, Toast, Confirm), localStorage for theme/locale.

### 4.1 Tokens the app actually uses — `@school/config-tailwind/preset.ts` + `apps/admin/src/app/globals.css`
- **Colors:** brand `violet #7A3FFF`/`light #B97BFF`; `coral`/`aqua` (theme-aware HSL vars); `ink` dark surfaces `#0B0518`→`#221547`; shadcn HSL bridge (`background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `card`, `border`, `input`, `ring`) — light + `.dark` variants in `globals.css`. **Default theme is dark.**
- **Radius:** single `--radius: 0.75rem` → lg/md/sm derived.
- **Shadows:** `card`, `glow`.
- **Gradients:** `grad-primary`, `grad-hero`.
- **Fonts:** `--font-display` **Sora**, `--font-body` **Inter**, `--font-mono` **JetBrains Mono** (self-hosted via `next/font`).

### 4.2 Local UI primitives — `apps/admin/src/components/` (8, ~211 lines)
`button` (variants default/secondary/outline/ghost/destructive), `card`, `badge` (tones default/success/warning/danger/muted), `input`+`select`, `field`, `table`, `spinner`, `index`. All thin wrappers over native HTML + Tailwind, composed with `cn()`.

### 4.3 Shell / providers / content (16 components)
app-shell, shell, logo, i18n-provider, toast, confirm, theme-locale-toggle, entity-picker, status-badge.

### 4.4 Routes (29, permission + feature-flag gated)
Dashboard `/`; People `/people/{students,teachers,parents,employees,cards}`; Structure `/structure/{schools,academic}`; `/academics`; Attendance `/attendance`,`/presence`; `/timetable`; Finance `/finance`,`/finance/fee-plans`; `/communication`; `/reports`; `/fleet`,`/inventory`,`/library`; `/clinic`; Settings `/settings/{users,roles,attendance,integrations/jofotara}`; `/modules`,`/platform/databases`,`/kitchen-sink`; Auth `/login`,`/change-password`; `/api/health`.

### 4.5 Cross-cutting support (already present ✅)
- **Dark mode:** `.dark` class on `<html>`, toggle, localStorage `munaxa.theme`.
- **RTL:** `dir` on `<html>` via `directionForLocale()`, Tailwind logical properties (ps/pe/ms/me/border-s/-e) used in shell.
- **i18n:** `@school/i18n` EN+AR (641 keys), `useI18n().t()`, localStorage `munaxa.locale`.

---

## 5. Compliance Assessment

### ✅ What is COMPLIANT (already aligned with the design system)
| Area | Notes |
|---|---|
| **Brand primary color** | `#7A3FFF` identical in reference and app |
| **No hardcoded colors in component code** | 0 in app components; only the brand palette in the preset + one print stylesheet in `reports/page.tsx` |
| **Centralized tokens** | App reads from a single shared preset + CSS-var bridge |
| **Dark mode** | Implemented, persisted, theme-aware vars |
| **RTL** | `dir` switching + logical properties |
| **i18n EN/AR** | Full bilingual catalog wired through context |
| **Permission/feature-flag-gated routing** | AppShell filters nav by `Principal.permissions` + flags |

### ⚠️ What is PARTIALLY COMPLIANT
| Area | Gap |
|---|---|
| **Tokens** | App preset covers color/radius/shadow/gradient/font, but is **missing** the reference system's **spacing scale, z-index scale, motion tokens, and first-class semantic colors** (success/warning/info exist only as ad-hoc `badge` tones, not tokens) |
| **Typography** | Brand color aligns, but **fonts diverge**: reference = **IBM Plex Sans / IBM Plex Sans Arabic**; app = **Sora / Inter / JetBrains Mono**. Arabic in particular lacks a dedicated Arabic face. **Needs a governance decision** (see §7) |
| **Core components** | App has 8 thin primitives that overlap in name (Button/Card/Badge/Input/Table) but are **not** the reference components and lack their variants, states, and a11y wiring |
| **Default theme** | Reference appears light-first; app is dark-first — needs confirmation of intended default |

### ❌ What is NON-COMPLIANT (largest gaps)
| Area | Gap |
|---|---|
| **`@school/ui` is empty** | Exports only `cn()`; **zero shared components.** There is no consumable component layer bridging the reference system to the app |
| **Reference DS not consumed** | `munaxadesignsystem/` is outside the workspace and imported nowhere. Its 53 primitives + 40 domain components + patterns are **unused by the product** |
| **Domain components** | App has essentially none (only `status-badge`, `entity-picker`); the 40+ domain components (StudentCard, AttendanceStatusBadge, InvoiceTable, FeeStatusCard…) are **not present in the app** |
| **Patterns** | Pages are bespoke; the documented Dashboard/CRUD/Workspace/Search/Audit patterns are **not systematically applied** (to be quantified in Phase 1) |
| **Record Workspace pattern** | Student/Teacher/Parent/Finance workspaces (header→summary→tabs→timeline→related→audit) **not yet verified as implemented** |

---

## 6. Compliance Mismatch Map (reference ↔ app)

| Concept | Reference (`munaxadesignsystem`) | App (`apps/admin`) | Reconciliation needed |
|---|---|---|---|
| Tailwind | v4 (`@theme inline`) | v3.4 (preset + CSS vars) | Token bridge strategy |
| Tokens home | TS objects in DS | `@school/config-tailwind` | Port missing scales into the preset |
| Components home | DS `components/ui` (53) | local 8 + empty `@school/ui` | Build/port into `@school/ui` |
| Domain components | DS `school/` (40+) | ~none | Port into `@school/ui` (or new pkg) |
| Fonts | IBM Plex Sans (+Arabic) | Sora/Inter/JetBrains | **Decision required** |
| Semantic colors | success/warning/danger/info tokens | destructive only | Add tokens |
| Spacing/z-index/motion | full scales | partial/none | Add tokens |
| Router | wouter | Next App Router | N/A (keep app's) |

---

## 7. Governance Decisions (RESOLVED 2026-06-18)

These governance-level decisions were posed at the Phase 0 gate and **answered by the product owner**. They are now binding for Phases 2–6:

1. **Component delivery strategy → PORT INTO `@school/ui`.** Reference primitives + domain components will be ported into the (currently empty) `@school/ui` package, adapted to Tailwind v3 / Next 15, as the single canonical consumable layer. The app will not import `munaxadesignsystem` directly (avoids the Tailwind v4 + wouter ↔ Next clash).
2. **Typography → ADOPT IBM Plex Sans (+ IBM Plex Sans Arabic).** The reference fonts are the source of truth. The app's current Sora/Inter/JetBrains stack will be migrated to IBM Plex Sans (Latin), IBM Plex Sans Arabic (RTL), and the reference mono. Rationale: dedicated Arabic face for RTL quality.
3. **Default theme → LIGHT-FIRST.** The app's default will be aligned to the reference system's light-first default. (Dark mode remains fully supported.)
4. **Token authority → `@school/config-tailwind` remains canonical; EXTEND it.** Missing scales (spacing, z-index, motion, first-class semantic colors success/warning/info) will be **added from the reference token values** — never invented.

---

## 8. Proposed Plan for Subsequent Phases

- **Phase 1 — Full Application Audit:** classify all 29 routes COMPLIANT / PARTIALLY / NON-COMPLIANT with per-page violations, severity, effort, and a 0–100 score.
- **Phase 2 — Token Migration:** port missing reference scales into `@school/config-tailwind`; confirm no hardcoded values remain.
- **Phase 3 — Core Components:** establish the canonical component layer in `@school/ui` and migrate app primitives onto it (preserving APIs/behavior).
- **Phases 4–6 — Patterns / Domain Components / Workspaces.**
- **Phases 7–14 — Search, Multi-tenant, Permissions, Audit, A11y, RTL, Dark mode, Performance.**
- **Phase 15 — Final Compliance Report.**

---

## 9. STOP — Phase 0 Complete

No files were modified. **Awaiting approval to begin Phase 1 (Full Application Audit).**

Please also weigh in on the four open questions in §7 — answers there shape Phases 2–6.
