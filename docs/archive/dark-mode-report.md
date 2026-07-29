# DARK_MODE_REPORT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration — **Phase 13 (Dark Mode)**
**Date:** 2026-06-18 · Branch `claude/affectionate-shannon-fbfeaf` · Status ✅ (scrim standardization + audit)

> No routes/APIs/logic changes.

## Findings

| Area | State | Detail |
|---|---|---|
| **Theme mechanism** | 🟢 | `.dark` class toggled on `<html>`; full light + dark CSS-var sets in `globals.css` (`--background`, `--card`, `--primary`, `--muted`, `--coral`, `--aqua`, etc.) |
| **Content surfaces** | 🟢 | every surface uses semantic tokens (`bg-card`, `bg-background`, `bg-secondary`, `text-foreground`, `text-muted-foreground`, `border-border`) — adapt automatically |
| **Brand accents** | 🟢 | `coral`/`aqua` are theme-aware (darker in light, full-brightness on dark); `primary` shifts (`#7A3FFF` → `#B97BFF` on dark) |
| **Forms / tables / badges** | 🟢 | all token-driven; domain status badges use `Badge` tones (token-based) |
| **Hardcoded colors** | 🟢 | none in app source (lint-enforced); reports print stylesheet is a separate print document (intentional) |
| **Modal backdrops** | 🟢 **(fixed this phase)** | were a literal `bg-black/50` in 7 hand-rolled dialogs; **standardized to the token-based `bg-foreground/40`** to match the new `Dialog`/`Drawer` primitives — one consistent, theme-aware scrim everywhere |

## Change made
- Standardized **all modal/drawer backdrops** to `bg-foreground/40` (token-based, theme-aware) across `confirm`, `app-shell` mobile drawer, and the 5 hand-rolled people dialogs — eliminating the last literal-color utility (`bg-black/50`) and the inconsistency between legacy dialogs and the new primitives.

## Verification
- ✅ admin build (36/36) · ✅ lint guardrail
- ✅ grep: no non-adaptive literal color utilities (`bg-white/black`, `text-white/black`, numbered gray scales) remain in `app/` + `packages/ui/src`

## Residual (recommend manual pass)
- Visual spot-check of dark theme across dialogs/charts/tables (toggle ☾) — the bar-chart fills use token classes (`bg-aqua`/`bg-coral`/`bg-primary`) and adapt.
- Confirm the `bg-foreground/40` frosted scrim reads well over dark surfaces (combined with `backdrop-blur` on the primitives).

**STOP — Phase 13 complete.** Proceeding to Phase 14 (Performance).
