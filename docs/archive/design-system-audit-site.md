# Munaxa Design System Audit

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

## Executive summary

The repository has a capable accessible primitive layer, a clear Munaxa visual identity, and broad component demonstrations. Its main limitation was architectural: product concepts, documentation, CSS variables, and demo pages were intermingled, leaving no typed domain layer for product teams or AI screen generation. This refactor adds a stable `client/src/design-system` boundary for tokens, themes, components, patterns, templates, guidelines, accessibility, RTL, and examples while preserving the existing brand and primitive APIs.

## Architecture review

### Folder structure

The application uses Vite, React 19, TypeScript, Tailwind CSS 4, Radix UI, and Wouter. Runtime code lives under `client/src`; Express serves the production build. The primitive library remains in `client/src/components/ui`, while product-level design-system assets now live in `client/src/design-system`:

```text
client/src/design-system/
├── tokens/
├── themes/
├── components/school/
├── patterns/
├── templates/
├── guidelines/
├── accessibility/
├── rtl/
└── examples/
```

This separation is appropriate: primitives can evolve independently from school-domain components, patterns, and page templates.

### Component organization

The existing `components/ui` layer contains a broad Radix/shadcn-style primitive set with consistent `data-slot` hooks and a shared `cn` utility. Previously, school components existed mainly as markup in `UIKitSchoolSpecific.tsx`. They now have typed reusable APIs and stable barrel exports for student, teacher, parent, attendance, fees, transport, school selection, avatar, status, and metrics.

### Documentation structure

Existing documentation is implemented as routed React pages and is easy to browse, but much of it mixed guidance with one-off demos. Canonical MDX guidance is now colocated with product patterns, templates, school components, AI generation, accessibility, RTL, and documentation standards. The Patterns, Templates, School Components, and Examples areas are linked from primary navigation.

### Token system

The original token system consisted primarily of CSS custom properties in `index.css`. It had a strong semantic start but no typed consumption API. Typed color, spacing, typography, radius, shadow, motion, and z-index modules now provide stable TypeScript exports. Values are defined once within each token domain; components use semantic CSS variables rather than raw colors.

### Theme system

The light and dark themes retain Munaxa purple `#7A3FFF`, the existing neutral palette, IBM Plex Sans/Arabic, and the established spacing character. `ThemeProvider` persists user preference and applies the `.dark` class. A typed theme contract now documents light and dark semantic values. A future build-time token-to-CSS generator should remove the remaining parallel representation between TypeScript tokens and CSS custom properties.

### Navigation structure

Navigation was flat, emoji-based, and omitted existing UI-kit routes. Primary navigation now exposes foundations, primitives, school components, patterns, templates, examples, accessibility, and RTL using a consistent Lucide icon set. It remains responsive and keyboard reachable. As the library grows, section headings and collapsible groups should replace the current long list.

## Strengths

- Clear, restrained enterprise SaaS visual direction with a distinctive primary color.
- Broad primitive coverage built on accessible Radix foundations.
- Strict TypeScript configuration and path aliases.
- Semantic CSS custom properties for background, foreground, surface, border, focus, charts, and status.
- Existing dark theme and Arabic font stack.
- Shared class-merging utility and consistent primitive composition style.
- Responsive documentation shell and route-based examples.
- Existing accessibility and RTL awareness in product language.
- Lucide already available, avoiding a new icon dependency.

## Weaknesses addressed

- Added a product-level design-system package boundary instead of storing every concept in pages.
- Added typed tokens instead of CSS-only primitives.
- Converted school concepts from static demos into reusable typed components.
- Added canonical workflow patterns and role-based dashboard templates.
- Added realistic examples that compose public APIs.
- Replaced visible emoji navigation and section iconography with Lucide icons.
- Added reduced-motion behavior and a consistent global focus-visible treatment.
- Added dedicated AI, accessibility, RTL, and documentation guidance.
- Added routes for previously undiscoverable product-system layers.

## Remaining weaknesses

- There is no automated accessibility, visual-regression, interaction, or token-contract test suite.
- The repository does not currently install dependencies in this environment, so compilation could not be executed here.
- Some legacy documentation pages still contain duplicated example markup and should be migrated onto the new components.
- Theme CSS and typed theme objects are parallel representations until generation is automated.
- The documentation shell will need grouped navigation, search, and versioned API references as content grows.
- Public components do not yet have Storybook-style isolated state matrices or package-level release metadata.

## Missing areas and recommendations

1. Add Vitest, Testing Library, axe, and keyboard interaction tests for public components.
2. Add visual regression for light, dark, LTR, RTL, mobile, and 200% zoom states.
3. Generate CSS custom properties and documentation tables from typed tokens during build.
4. Add locale-aware date, number, currency, and name-formatting utilities.
5. Add data-table, filter-bar, page-header, form-layout, and permission-boundary product components.
6. Define deprecation, contribution, ownership, release, and adoption policies.
7. Publish the design-system boundary as a versioned workspace package when multiple applications consume it.
8. Add design-token export for design tools and mobile platforms.
9. Measure adoption, component coverage, accessibility defects, and escape-hatch usage.

## Production readiness assessment

The architecture is now suitable for continued production development and significantly safer for AI-generated UI because it offers explicit typed layers above primitives. Production rollout should be gated on installing dependencies, running TypeScript/build checks, adding automated accessibility coverage, and migrating legacy page markup incrementally rather than in one breaking release.
