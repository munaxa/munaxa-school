# MUNAXA Design System - Visual Direction

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

## Design Philosophy: Enterprise Elegance

The MUNAXA Design System documentation website embodies **Enterprise Elegance**—a sophisticated, premium aesthetic that reflects the power and intelligence of a modern school operating system. This is not playful or experimental; it is deliberate, professional, and crafted for decision-makers.

## Core Design Principles

1. **Information Hierarchy Over Decoration**: Every visual element serves a purpose. Content density is optimized for scanning and comprehension, never for visual novelty.
2. **Calm, Spacious Layouts**: Generous whitespace creates breathing room. Sections are clearly separated. The eye can rest.
3. **Premium Simplicity**: Refined typography, subtle depth, and restrained color create an impression of quality and confidence.
4. **Accessibility as Foundation**: WCAG AA compliance, keyboard navigation, and RTL support are built in from day one, not bolted on later.

## Design Movement

**Inspiration**: Linear, Stripe, Notion, Ramp, Vercel—modern SaaS platforms that prioritize clarity and efficiency while maintaining visual sophistication.

**Anti-inspiration**: Legacy ERP systems, Microsoft Dynamics, SAP, Moodle—cluttered, overwhelming, and visually dated.

## Color Philosophy

### Primary Brand Color: #7A3FFF (Deep Purple)
This is MUNAXA's signature color—vibrant enough to command attention, sophisticated enough for enterprise contexts. It signals innovation and intelligence without being playful.

### Palette Composition
- **80% Neutral (Gray)**: The backbone of the design. Neutral tones create calm and reduce cognitive load.
- **15% Primary (Purple)**: Strategic accent for CTAs, highlights, and key information.
- **5% Semantic (Green/Red/Amber/Blue)**: Status indicators and feedback.

### Color Tokens (Light Mode)
- **Primary**: #7A3FFF (brand color)
- **Gray-50 to Gray-900**: Full neutral spectrum for text, backgrounds, borders
- **Success**: #10B981 (emerald)
- **Warning**: #F59E0B (amber)
- **Error**: #EF4444 (red)
- **Info**: #3B82F6 (blue)

### Dark Mode
- **Background**: #0B1020 (deep navy, not pure black)
- **Surface**: #111827 (slightly lighter for depth)
- **Card**: #1A2332 (elevated surfaces)
- **Text Primary**: #F9FAFB (off-white, not pure white)
- **Text Secondary**: #CBD5E1 (muted for secondary info)
- **Never**: Pure black, neon effects, cyberpunk aesthetics

## Layout Paradigm

### Application Shell
```
┌─────────────────────────────────────┐
│ Header (72px)                       │
├──────────┬──────────────────────────┤
│ Sidebar  │ Main Content             │
│ (280px)  │ (Fluid, responsive)      │
│          │                          │
└──────────┴──────────────────────────┘
```

**Sidebar**: Fixed-width (280px), white background, light border. Contains main navigation with active state highlighting.

**Header**: Contains global search, notifications, school switcher, user menu, and KPI cards.

**Main Content**: Fluid, responsive. Optimized for both dense data and spacious documentation.

## Signature Elements

1. **Rounded Corners**: 
   - Cards: 12px
   - Buttons: 8px
   - Inputs: 8px
   - Modals: 16px
   - Creates visual softness without being playful

2. **Borders Over Shadows**: 
   - Prefer subtle 1px borders (Gray-200) over drop shadows
   - Shadows used sparingly: Small (0 1px 2px), Medium (0 4px 12px), Large (0 10px 30px)
   - Creates clarity and reduces visual noise

3. **Data Density Optimization**:
   - Tables with search, filter, export, pagination, column visibility
   - Compact spacing for operational efficiency
   - Generous whitespace in documentation areas

## Typography System

### Primary Font: IBM Plex Sans Arabic
- Designed for clarity and readability in both English and Arabic
- Professional, modern, highly legible
- Fallback: Inter, system-ui, sans-serif

### Font Scale
- **Display XL**: 56px (hero titles)
- **Display LG**: 48px (page titles)
- **H1**: 40px (section headers)
- **H2**: 32px
- **H3**: 24px
- **H4**: 20px
- **H5**: 18px
- **H6**: 16px
- **Body LG**: 16px (primary body text)
- **Body MD**: 14px (secondary text)
- **Body SM**: 12px (labels, metadata)

### Typography Rules
- Use weight variation to create hierarchy: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- Never rely on size alone for hierarchy—combine with weight and color
- Maintain consistent line-height: 1.5 for body, 1.2 for headings

## Spacing System

Consistent 4px base unit:
- 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px

**Application**:
- Padding inside components: 12px–16px
- Margin between sections: 32px–64px
- Whitespace in documentation: generous, never cramped

## Interaction Philosophy

### Motion System
**Durations**: 150ms (quick), 200ms (standard), 250ms (deliberate)

**Allowed**:
- Fade (opacity changes)
- Slide (positional movement)
- Scale 98→100 (subtle entrance)

**Avoided**:
- Bounce, elastic, overshoot (too playful)
- Excessive effects (distracting)

**Rules**:
- Keyboard-initiated actions: instant (no animation)
- Hover effects: 150ms fade or subtle scale
- Modal/drawer entrance: 200–250ms slide + fade
- Respect `prefers-reduced-motion`

### Focus States
- Required for keyboard navigation
- Visible ring: 2px, primary color
- Never rely on color alone

## Brand Essence

**One-line positioning**: Run Your School From One Operating System.

**Personality Adjectives**: Professional, Intelligent, Calm

**Brand Voice**:
- Headlines: Direct, benefit-focused ("Unified Operations," "Streamlined Finance," "Real-Time Insights")
- CTAs: Action-oriented ("Explore Components," "View Guidelines," "Learn More")
- Microcopy: Clear, jargon-free, helpful

**Example Lines**:
- "Everything your school needs, nothing it doesn't."
- "Enterprise software that feels effortless."

## Wordmark & Logo

**Concept**: A bold, geometric symbol representing unity and integration. Think interconnected nodes or a unified system. The mark is a standalone graphic (no text), used in the header and as favicon.

**Characteristics**:
- Geometric and modern
- Works at all sizes
- Primarily uses the brand purple (#7A3FFF)
- Conveys integration and intelligence

## Responsive Breakpoints

- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

**Design approach**: Mobile-first. Build for small screens first, then enhance for larger screens.

## RTL Support

Every component must support `dir="rtl"`:
- Mirrored layouts
- Arabic typography (IBM Plex Sans Arabic)
- Proper table alignment
- Icon alignment

## Accessibility Requirements

- **Minimum contrast**: 4.5:1 (WCAG AA)
- **Focus states**: Required and visible
- **Keyboard navigation**: Full support
- **Screen readers**: Semantic HTML, ARIA labels where needed

## Design System Documentation Structure

1. **Home**: Overview, quick links to key sections
2. **Design Tokens**: Colors, typography, spacing, shadows, radius
3. **Components**: Buttons, inputs, cards, tables, modals, charts
4. **Patterns**: Common UI patterns and layouts
5. **Accessibility**: Guidelines, contrast checker, keyboard nav
6. **Theme**: Light/dark mode switcher
7. **RTL**: Arabic language support demo

## Implementation Notes

- Use Tailwind CSS 4 with OKLCH color format
- Use shadcn/ui components as base
- Use Lucide Icons (2px stroke, rounded)
- Use Recharts for data visualization
- Use React Hook Form + Zod for forms
- Use TanStack Table for data tables
- Implement theme switcher (light/dark)
- Support RTL with `dir="rtl"` attribute
- Ensure all interactive elements are keyboard accessible

---

**Status**: Design direction finalized. Ready for implementation.
