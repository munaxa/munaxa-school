# MUNAXA Enterprise Documentation Architecture

## Purpose

Documentation is the discoverable contract connecting foundations, components, domain concepts, product patterns, workspaces, governance, implementation, and migration. It serves designers, engineers, product managers, content/localization, QA, accessibility, support, auditors, and AI agents.

## Principles

- Organize by user decision and system layer, not repository accident.
- One canonical page per public contract; examples link rather than fork.
- Every page states owner, lifecycle, version, last review, and related standards.
- Search indexes concepts, aliases, APIs, Arabic/English terminology, and migration references.
- Human-readable and machine-readable content derive from the same metadata.

## Navigation structure

~~~text
Home
├── Foundations
│   ├── Tokens, themes, typography, motion
│   ├── Accessibility, RTL, dark mode
│   └── Content and visualization
├── Components
│   ├── UI primitives
│   ├── School components
│   ├── Domain components
│   └── Component lifecycle
├── Product Architecture
│   ├── Patterns and templates
│   ├── Permissions, workflows, notifications
│   ├── School Domain Architecture
│   └── Enterprise Workspace Architecture
├── Enterprise Standards
│   ├── Governance
│   ├── Search
│   ├── Multi-tenant context
│   ├── Audit and compliance
│   └── Documentation
├── Examples
└── Releases
    ├── Changelog
    ├── Migrations
    ├── Deprecations
    └── Roadmap
~~~

## Page hierarchy

Each standard page follows: Purpose, Principles, Rules, UX Guidelines, Visual Guidelines, Accessibility, RTL, Arabic/English examples, Do/Don’t, Real UI Examples, Enterprise Best Practices, Implementation Notes, Related Pages, Owner/Lifecycle.

Component pages add anatomy, typed props, variants, states, content, permissions, workflow/notification integration, tests, and migration. Pattern pages add layout diagram, entry/exit conditions, system states, and domain examples.

## Cross-linking strategy

- Foundations link to components that consume tokens.
- Components link upward to patterns/workspaces and sideways to content/accessibility.
- Workspaces link to permissions, workflows, notifications, relationships, timeline, and audit.
- Governance links every lifecycle/deprecation badge to proposal, release, and migration.
- Examples link only canonical APIs; canonical pages link back to representative examples.
- Avoid circular “See also” lists without explaining the relationship.

## Searchable structure

Each page supplies stable ID/URL, title, summary, layer, domain, audience, keywords/synonyms, Arabic terms, component/API names, lifecycle, version, owner, headings, related IDs, and last review. Code examples are indexed separately from prose. Deprecated results rank below replacements and show migration.

Filters: layer, domain, platform, lifecycle, role/audience, accessibility, RTL, release. Search supports exact API names, business terminology, error IDs, and Arabic/English aliases.

## Documentation workflow

Documentation ships in the same change as code/design. Review gates match the underlying asset. Broken links, stale examples, accessibility, terminology, code compilation, lifecycle metadata, and search index generation run in CI. Owners receive review reminders and adoption/support feedback.

## English and Arabic examples

English navigation: Product Architecture → Enterprise Workspaces → Student Workspace. Arabic: بنية المنتج ← مساحات العمل المؤسسية ← مساحة عمل الطالب.

English search: Search components, patterns, and migration guides. Arabic: ابحث في المكونات والأنماط وأدلة الترحيل.

## Accessibility

Use semantic landmarks, one page heading, ordered heading levels, skip links, accessible tables/diagrams, descriptive links, code-language labels, keyboard search, focus management, zoom/reflow, and reduced motion. Mermaid diagrams require adjacent text equivalents.

## RTL considerations

Documentation shell supports dir=rtl and Arabic navigation labels. Code remains LTR in isolated blocks. Mixed API names and paths are isolated. Diagrams preserve semantic sequence while labels and layout adapt.

## Do / Don’t

Do colocate ownership/version metadata, compile examples, cross-link intentionally, and archive history. Don’t duplicate canonical guidance, publish undocumented APIs, bury deprecations, use screenshots as the only instruction, or rely on English-only search.

## Enterprise best practices

Provide versioned docs, per-release snapshots, API reference generation, runnable examples, contribution templates, status/lifecycle registry, analytics respecting privacy, feedback ownership, and an AI-consumable manifest.

## Implementation notes

Generate a documentation registry from front matter and TypeScript exports. Validate required sections and links in CI. Include locale-specific search indexes. Preserve stable URLs through redirects and record removed pages in migration notes.

