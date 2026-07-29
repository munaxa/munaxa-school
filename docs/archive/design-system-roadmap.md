# Munaxa Design System Roadmap

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

## Phase 1 — Foundation

**Outcome:** one dependable source of primitives and semantic decisions.

- Complete typed-token-to-CSS generation and validation.
- Define public API boundaries and package exports.
- Add Vitest, Testing Library, axe, visual regression, and bundle checks.
- Establish browser, mobile viewport, dark mode, and RTL support matrices.
- Add locale-aware formatting utilities.

**Exit criteria:** token changes generate all platform outputs; public primitives pass type, interaction, accessibility, and visual checks.

## Phase 2 — Patterns

**Outcome:** consistent workflows across school operations.

- Validate Dashboard, CRUD, Student Profile, Attendance, Finance, Reports, Settings, and system-state patterns with product teams.
- Add admissions, communication, transport, HR, and approval patterns.
- Connect each pattern to analytics events and permission expectations.

**Exit criteria:** new product work references a documented pattern or records an approved exception.

## Phase 3 — Templates

**Outcome:** production-ready role-based starting points.

- Connect the five dashboard templates to real data contracts.
- Add responsive chart/table implementations and data freshness indicators.
- Add loading, empty, partial-data, error, and permission variants.
- Validate information hierarchy with principals, finance staff, teachers, and operations teams.

**Exit criteria:** templates ship in at least one production portal with measured task success.

## Phase 4 — School components

**Outcome:** stable APIs for core Munaxa concepts.

- Add data table, filter bar, entity header, guardian relationship, enrollment status, payment timeline, route stop, and approval components.
- Add interaction and accessibility test matrices for every public component.
- Migrate legacy documentation demos onto public component APIs.

**Exit criteria:** core portals share domain components without copied markup or raw visual values.

## Phase 5 — AI generation support

**Outcome:** AI-created screens are structurally correct, accessible, and on-brand.

- Turn guidelines into machine-readable composition constraints and examples.
- Add lint rules for raw colors, emoji icons, physical-direction utilities, unlabeled controls, and unsupported component imports.
- Create evaluation fixtures for dashboard, table, form, dark-mode, RTL, and error-state generation.
- Score generated screens for component reuse, token use, hierarchy, accessibility, and domain realism.

**Exit criteria:** generated screens pass automated constraints and human review without structural rework.

## Phase 6 — Design system governance

**Outcome:** sustainable cross-product ownership and adoption.

- Assign maintainers and domain reviewers; publish contribution and deprecation policies.
- Adopt semantic versioning, changelogs, migration guides, and release cadence.
- Add RFCs for new patterns and components.
- Track adoption, defects, accessibility conformance, API churn, and escape-hatch usage.
- Establish design/code parity reviews and quarterly product audits.

**Exit criteria:** teams can predict changes, contribute safely, and measure system health.

## Current delivery

Created typed foundations, themes, school components, product patterns, five dashboard templates, six workflow examples, dedicated AI/accessibility/RTL guidance, documentation standards, audit, and roadmap. Modified application routing, primary navigation, focus/motion behavior, and visible iconography. Remaining priorities are automated verification, token CSS generation, and incremental migration of legacy demo markup.
