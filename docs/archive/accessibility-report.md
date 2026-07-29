# ACCESSIBILITY_REPORT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration — **Phase 11 (Accessibility)**
**Date:** 2026-06-18 · Branch `claude/affectionate-shannon-fbfeaf` · Status ✅ (reduced-motion + skip link + cumulative a11y)

> No routes/APIs/logic changes.

## Cumulative a11y posture (built up across phases)

| WCAG area | State | Where addressed |
|---|---|---|
| **Form labels** | 🟢 | `Field` wrapping with `htmlFor`/`id` swept across forms (P3/3b); `Field` supports `error`/`required` |
| **Tables** | 🟢 | `TH` defaults `scope="col"` (P3); timetable grid headers scoped |
| **Keyboard nav** | 🟢 | `Tabs` roving-tabindex + arrows; `EntityPicker` combobox ↑/↓/Enter/Esc (P7); `Dialog`/`Drawer` Esc + focus restore |
| **ARIA roles** | 🟢 | combobox/listbox/option, dialog `aria-modal`+labelledby, `role="switch"`, `role="tablist/tab/tabpanel"`, `role="alert"` on errors |
| **Focus states** | 🟢 | all primitives use `focus-visible:ring-*` tokens |
| **Icon-only buttons** | 🟢 | `aria-label`s on close/delete/toggle controls (P3b) |
| **Contrast** | 🟢 | token palette (brand `#7A3FFF` etc.) on themed surfaces; no hardcoded low-contrast colors remain |
| **Skip to content** | 🟢 **(this phase)** | new skip link in `app-shell` → `#main-content` |
| **Reduced motion** | 🟢 **(this phase)** | global `prefers-reduced-motion` rule neutralizes animation/transition/scroll |

## Changes made this phase
1. **Skip-to-content link** (`app-shell`): first focusable element, visually hidden until focused (`sr-only`/`focus:not-sr-only`), jumps to `<main id="main-content">`. New i18n key `shell.skipToContent` (EN + AR).
2. **Reduced-motion** media query in `globals.css`: collapses animation/transition durations and disables smooth scroll for users with the OS preference (WCAG 2.3.3). Complements the design system’s motion tokens.

## Verification
- ✅ `@school/i18n` build · ✅ admin typecheck · ✅ admin build (36/36) · ✅ lint guardrail.

## Residual (recommend manual/automated pass)
- Run **axe**/Lighthouse for contrast-ratio confirmation on themed surfaces and any dynamic states.
- Verify focus order within the larger record dialogs after the Tabs refactor (manual SR pass).
- `EmptyState`/empty list rows: ensure `aria-live` where content loads async (nice-to-have).

**STOP — Phase 11 complete.** Proceeding to Phase 12 (RTL).
