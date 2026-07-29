# Munaxa School Domain Architecture

## Purpose

The domain layer turns generic primitives into stable School Operating System concepts. It lives at client/src/domain-components and composes the existing tokens, UI primitives, patterns, permissions, workflows, and notifications without replacing them.

## Naming conventions

- Use domain language recognizable to school staff: StudentCard, not UserTile.
- Components use PascalCase; props use camelCase; status unions use lowercase kebab-case.
- Card is a concise entity or transaction summary. Panel is a grouped detail region. Widget is an operational aggregate. Header establishes persistent entity context.
- StatusBadge labels lifecycle state. Metrics is a responsive group; MetricCard is one value.
- Avoid role or permission names in visual component names.

## Composition rules

1. Product pattern defines page structure.
2. Permission and scope filter data and transitions.
3. Domain components express school concepts.
4. Shared components provide consistent identity, status, metrics, timelines, and actions.
5. UI primitives handle interaction mechanics.
6. Tokens provide all visual values.

Do not fetch data, authorize, or perform workflow transitions inside presentation components. Prefer composition props over variants that mix unrelated business concepts.

## Hierarchy rules

- One IdentityHeader or page header establishes entity and active scope.
- Use no more than four top-level metrics.
- Primary workflow content precedes history and secondary metadata.
- Exceptions sit beside the data they explain.
- Quick actions contain frequent, permitted actions; destructive or approval actions remain explicit.
- Cards never flatten every piece of information into equal visual weight.

## Domain ownership

Students owns identity and enrollment presentation. Teachers owns staff teaching context, not HR. Parents owns guardian relationships and linked-child summaries. Attendance owns register state and resolution signals. Finance owns immutable transaction presentation. Transport owns route, vehicle, boarding, and trip status. Communication owns governed message lifecycle. Reports owns parameters, freshness, ownership, visualization framing, and export state. Shared owns domain-neutral composition only.

## Permission considerations

Apply permissions-ux.md before rendering. Components assume safe, scoped data. Hidden controls do not enforce security. Sensitive counts, tags, autocomplete, notifications, and exports follow the same scope. Finance, safeguarding, health, and staff data require field-level capabilities.

## Workflow integration

Status props map to server-owned states documented in workflow-ux.md. Components render current state and permitted actions but do not invent transitions. Mutations include record version, audit reason where required, idempotency key where applicable, and recoverable conflict handling.

## Notification integration

Domain events drive the notification policy in notifications-ux.md. Components may show durable state or current-action feedback, but channel selection, priority, deduplication, consent, and escalation remain policy services.

## Accessibility requirements

Meet WCAG 2.2 AA. Use semantic structure, visible labels, named controls, keyboard operation, clear focus, non-color statuses, reduced motion, 200% zoom, and screen-reader announcements. Timelines are ordered; metrics retain labels; heatmaps provide textual equivalents.

## RTL requirements

Arabic is first class. Use logical flow, localized content, and direction isolation for IDs, currency, phone numbers, and mixed strings. Do not mirror logos, numbers, clocks, charts, media controls, or universal symbols.

## Dark mode requirements

Use semantic tokens and the current enterprise palette. Preserve contrast and hierarchy. No neon, glow, glassmorphism, transparent decorative surfaces, or color-only status.

## AI generation requirements

AI selects a pattern and role/scope first, composes public domain APIs, implements all system states, and cites assumptions in code comments only where they affect behavior. It may not duplicate component markup, use raw colors, invent permissions, or create client-only workflow state.

## Cross-links

- Product patterns: client/src/design-system/patterns
- Templates: client/src/design-system/templates
- Permission architecture: permissions-ux.md
- Workflow architecture: workflow-ux.md
- Notification architecture: notifications-ux.md
- Domain AI rules: ai-domain-guidelines.md
- Component documentation: client/src/domain-components/*/README.mdx
- Complete examples: client/src/domain-components/examples

