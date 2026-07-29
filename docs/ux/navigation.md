# Munaxa Enterprise Navigation Architecture

## Global navigation

Global navigation selects product domains and organization-level tools. It is role and scope aware but cannot be the security boundary. Keep labels stable, use Lucide icons, group by user mental model, and avoid exposing empty unauthorized domains.

## Workspace navigation

Workspace navigation uses tabs for stable facets of the active record. The header retains identity and state. Tabs have durable URLs, preserve safe local state, and do not contain one-off commands.

## Context navigation

Related Records and inline links move between connected records. The destination clearly changes record identity and provides a reliable route back to origin context.

## Breadcrumb rules

Breadcrumbs represent hierarchy: School → Domain → Record. Use human-readable record label with ID available nearby. Collapse intermediate levels responsively; never use breadcrumbs as browser history.

## Deep linking

Every workspace tab, related-record view, search result, approval, and audit reference has a stable authorized URL. Do not place sensitive names or values in query strings. Invalid/expired links explain state without disclosing protected record existence.

## Search

Global search opens records across permitted domains. Domain search applies domain fields and filters. Search state is keyboard accessible, debounced, cancellable, scope-labelled, and safe against unauthorized inference.

## Cross-record examples

Student invoice link opens the Invoice workspace with a return link to Student → Finance. An attendance alert opens Student → Attendance at the resolution episode. A guardian link opens Parent → Children with the originating student highlighted.

## RTL and accessibility

Use landmarks, skip links, named navigation regions, current-page state, logical focus, and responsive keyboard operation. Mirror directional navigation in RTL but not record IDs, numbers, logos, charts, or timestamps.

