# Orbix Studio — Design System Clone

A standalone showcase of the **Orbix Studio** design system: the shadcn/ui theme
distributed as preset `b7BFbeatk`, rendered with real components in light + dark.

It is intentionally self-contained and **not** part of the Munaxa pnpm workspace
(it has its own `pnpm-workspace.yaml`), so it can't affect the main apps or the
existing `munaxadesignsystem`.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (new-york) |
| Primitives | Radix UI |
| Icons | Lucide |
| Animations | Motion (`motion/react`) |
| Charts | Recharts |
| Data tables | TanStack Table |
| Forms | React Hook Form + Zod |

## The theme

The design system _is_ a [shadcn/ui](https://ui.shadcn.com) theme. Its identity:

| Token | Value |
| --- | --- |
| Primary | `oklch(0.52 0.105 223.128)` — cool teal/cyan |
| Neutrals | cool-gray (hue ~213–228) |
| Radius | `0.45rem` (tight) |
| Mode | light-first, full dark mode |

All tokens live in [`src/app/globals.css`](./src/app/globals.css) under `:root` /
`.dark` and are mapped to Tailwind v4 utilities via `@theme inline`.

## Run it

```bash
cd orbix-studio
pnpm install
pnpm dev        # http://localhost:5180
pnpm build      # production build
```

## Apply this theme to another shadcn project

In any project already wired for shadcn/ui:

```bash
pnpm dlx shadcn@latest apply --preset b7BFbeatk
```

…or copy the `:root` and `.dark` blocks from `src/app/globals.css` into that
project's global stylesheet.

## What's included

- **Tokens** — full color scale, charts, sidebar, radius (`src/app/globals.css`)
- **Components** (new-york) — Button, Card, Badge, Input, Label, Switch, Tabs,
  Separator, Avatar, Table (`src/components/ui/`)
- **Demos** — Recharts revenue chart, TanStack sortable students table, RHF + Zod
  enroll form (`src/components/demos/`)
- **Showcase** — animated (Motion) hero, color swatches, and component gallery
  with a working light/dark toggle (`src/app/page.tsx`)

Add more components anytime with `pnpm dlx shadcn@latest add <component>`.
