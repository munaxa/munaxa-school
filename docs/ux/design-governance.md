# MUNAXA Design Governance

## Purpose

Governance keeps the design system trustworthy across portals, mobile, marketing, AI-generated interfaces, tenants, and product teams. It balances contribution speed with accessibility, compatibility, documentation, and product coherence.

## Principles

1. Public APIs are products with owners and consumers.
2. Contribution decisions are evidence-based and recorded.
3. Accessibility, RTL, dark mode, content, permission, and tenant context are release criteria.
4. Prefer composition and extension over parallel components.
5. Breaking change is a last resort with migration support.
6. AI-generated changes follow the same review gates as human-authored work.

## Ownership model

| Responsibility | Accountable owner | Required partners |
|---|---|---|
| Tokens and primitives | Design System Lead | Frontend Platform, Accessibility |
| Domain components | Domain Product Lead | Design System, Domain Engineering |
| Patterns/workspaces | Product Architecture Lead | UX Research, Security, Domain teams |
| Content standards | Content Design Lead | Localization, Support, Legal |
| Accessibility/RTL | Accessibility Lead | Arabic UX, QA, Engineering |
| Releases/tooling | Frontend Platform Lead | Design System maintainers |
| Adoption/governance | Design System Council | Product/Engineering leadership |

The Design System Council meets monthly for roadmap, deprecation, exception, and breaking-change decisions. Every public asset has a named design owner, engineering owner, documentation owner, and review date.

## Contribution process

~~~mermaid
flowchart LR
  Need[Validated need] --> Search[Search existing system]
  Search --> Compose{Can compose existing APIs?}
  Compose -->|Yes| Example[Add pattern/example]
  Compose -->|No| Proposal[Component proposal]
  Proposal --> Experiment[Experimental implementation]
  Experiment --> Review[Design + engineering + a11y + product review]
  Review --> Pilot[Pilot with consumers]
  Pilot --> Stable[Stable release]
~~~

Contributors provide problem evidence, affected roles/domains, usage frequency, alternatives considered, proposed API, permission/workflow implications, accessibility behavior, RTL/dark states, content, examples, tests, migration impact, and named owner.

## Component proposal workflow

1. Open an RFC with problem—not a visual solution.
2. Identify existing primitives, domain APIs, and escape hatches.
3. Define anatomy, responsibilities, non-goals, typed API, variants, states, responsive behavior, content constraints, and telemetry.
4. Prototype the minimum compositional API.
5. Validate with two independent product contexts before Stable.
6. Record the decision and rejected alternatives.

Proposal outcomes: accept for experiment, return for evidence, solve through documentation/example, merge into an existing API, or reject with rationale.

## Review and approval

| Gate | Required approval | Evidence |
|---|---|---|
| Design | Design System + domain designer | anatomy, hierarchy, variants, states, content |
| Engineering | Platform + domain engineer | API, composition, performance, testability |
| Accessibility | Accessibility reviewer | semantics, keyboard, focus, screen reader, zoom |
| Product | Domain product owner | validated workflow and adoption plan |
| Security/privacy | When sensitive | permission, tenant isolation, logging, minimization |
| Localization/RTL | Arabic UX reviewer | real Arabic content and bidirectional behavior |

The component owner cannot waive mandatory gates alone. Exceptions have scope, rationale, risk owner, expiry, and remediation issue.

## Component lifecycle

~~~mermaid
stateDiagram-v2
  Proposed --> Experimental: RFC accepted
  Experimental --> Stable: pilot + all gates
  Experimental --> Archived: evidence fails / no owner
  Stable --> Deprecated: replacement approved
  Deprecated --> Archived: support window ends
  Deprecated --> Stable: deprecation withdrawn
~~~

- **Proposed:** no implementation guarantee; decision under review.
- **Experimental:** usable only by named pilots; API may change; clearly labelled.
- **Stable:** documented, tested, owned, supported, and semantically versioned.
- **Deprecated:** safe replacement and migration guide exist; warnings enabled.
- **Archived:** frozen for historical reference; not importable in new work.

## Versioning strategy

Use Semantic Versioning for public packages.

- PATCH: bug, accessibility, documentation, or visual fix with no intended API/behavior break.
- MINOR: backwards-compatible component, prop, token alias, pattern, or opt-in behavior.
- MAJOR: removed/renamed API, changed default behavior, token meaning change, DOM/keyboard contract break, or unsupported platform removal.

Visual changes that materially affect layout, screenshots, density, or content capacity may be breaking even without TypeScript errors. Accessibility fixes may ship as PATCH when they restore the documented contract; announce behavior impact.

## Release process

1. Changeset names lifecycle and version impact.
2. CI runs types, unit/interaction, axe, RTL, visual, build, and bundle checks.
3. Maintainer reviews generated changelog and migration notes.
4. Release candidate is tested by named consuming applications.
5. Publish package, docs, design libraries, and release notes together.
6. Monitor errors, adoption, support, and rollback signals.

Release notes contain Added, Changed, Fixed, Deprecated, Removed, Security, Migration, and Known Issues. Emergency security releases follow incident policy and document consumer action privately where needed.

## Migration and deprecation

Deprecation requires replacement, reason, first warning version, support window, codemod/manual steps, examples, owner, and removal major version. Warn in types, development console where useful, documentation, and release notes. Never silently swap semantics.

### Button v1 → Button v2 example

**Reason:** v2 unifies loading semantics and accessible icon labels. **Window:** deprecated in 2.8, removed in 3.0.

Before:

~~~tsx
<ButtonV1 busy icon="save">Save</ButtonV1>
~~~

After:

~~~tsx
<Button loading loadingLabel="Saving" leadingIcon={<Save aria-hidden />}>
  Save
</Button>
~~~

Migration: replace busy with loading, provide loadingLabel, replace string icon with Lucide element, verify no duplicate submission, and test announcement/focus. A codemod handles prop renames; teams manually author labels.

### Replacement strategy

Mark the deprecated export, link replacement documentation, provide an adapter only when it preserves behavior, measure remaining imports, contact owners before removal, and archive source/docs after the major release.

## Breaking change policy

Breaking changes require council approval, consumer inventory, impact score, migration owner, release candidate, rollback plan, minimum announced window, and major version. Security, privacy, or severe accessibility breaks may shorten the window with executive risk approval and direct consumer communication.

## Documentation standards

Every public asset documents Overview, Purpose, Usage, Anatomy/API, Variants, States, Content, Examples, Do/Don’t, Accessibility, RTL, Dark Mode, Permissions, Workflows, Notifications, lifecycle, owner, and last review. Examples use approved APIs and realistic bilingual domain content.

## Review checklists

### Design

- Solves validated repeated need; existing composition considered.
- Hierarchy, responsive behavior, all states, and content limits defined.
- Tokens and established identity preserved.
- Dark, RTL, long text, Arabic, mobile, and 200% zoom reviewed.

### Engineering

- Typed minimal API; controlled/uncontrolled behavior explicit.
- No business authorization in presentation code.
- SSR/hydration, performance, bundle, errors, and telemetry considered.
- Unit, interaction, visual, RTL, and migration tests present.

### Accessibility

- Semantic HTML, accessible names, keyboard model, focus, and announcements documented.
- Contrast, forced colors, reduced motion, reflow, target size, and screen readers tested.
- Status does not depend on color; errors and help are programmatically connected.

### Product

- Role, task, scope, frequency, workflow, and measurable outcome validated.
- Permissions, approval, audit, notifications, tenant context, and support impact defined.
- Adoption owner and success metric assigned.

## Accessibility and RTL

Governance artifacts themselves are accessible and bilingual-ready. Reviews include Arabic screen-reader output, logical focus/reading order, mixed-direction values, and translated-content expansion.

## Do / Don’t

Do publish ownership, lifecycle, decisions, and migration support. Do measure adoption and exceptions. Don’t stabilize unowned experiments, create permanent forks, skip review for AI output, or remove APIs without evidence and a supported path.

## Implementation notes

Store RFCs and decisions beside code, require changesets in pull requests, expose lifecycle metadata through documentation navigation, lint deprecated imports, and maintain a machine-readable component registry for AI tooling.

