# Munaxa AI Product Architecture Guidelines

## Core rules

1. AI creates Workspaces before Pages.
2. AI models Records before Widgets.
3. AI prefers Relationships over isolated or duplicated screens.
4. AI includes Timeline wherever business history affects decisions.
5. AI includes Audit Trail for critical access, change, finance, approval, correction, export, and policy actions.
6. AI uses Related Records instead of copying target data into the current record.
7. AI applies capability, scope, state, and field-level permissions before rendering.
8. AI supports Arabic-first RTL and enterprise dark mode.

## Generation sequence

Identify the record, owner, scope, relationships, workflow state, valid actions, approvals, notifications, history, and audit requirements. Select a workspace pattern. Compose the approved domain and shared components. Add system states. Verify keyboard, screen reader, zoom, contrast, reduced motion, RTL, dark mode, and sensitive-data behavior.

## Prohibited output

No disconnected dashboard when a record workspace is required. No generic widget replacing a known record. No client-only workflow transition. No copied related data. No hidden-button security. No emoji icons, raw colors, physical left/right positioning, neon, glow, or glassmorphism.

## Cross-links

Workspace model: workspaces.md. Record workspaces: record-workspaces.md. History and governance: timeline.md and audit-trail.md. Relationships: related-records.md and domain-relationships.md. Navigation/search: navigation.md and search-pattern.md. Components: domain-components-architecture.md.

