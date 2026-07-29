# RTL_REPORT.md

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

**Program:** Munaxa Design System Migration — **Phase 12 (RTL)**
**Date:** 2026-06-18 · Branch `claude/affectionate-shannon-fbfeaf` · Status ✅ (verification) · **no code change required**

> No routes/APIs/logic changes.

## Findings

| Area | State | Detail |
|---|---|---|
| **Direction wiring** | 🟢 | `<html dir>` set in `layout.tsx` from locale; **flipped live** on locale switch in `i18n-provider` (`el.dir = directionForLocale(locale)`) |
| **Logical properties** | 🟢 | **zero physical-direction utility classes** remain (`ml-/mr-/pl-/pr-/text-left/text-right/left-/right-/border-l/-r/rounded-l/-r`). 22 files use logical `ps-/pe-/ms-/me-/text-start/text-end/border-s/-e/start-/end-` |
| **Arabic typography** | 🟢 | IBM Plex Sans Arabic wired (Phase 2b); Latin face falls through to it for Arabic glyphs |
| **Navigation** | 🟢 | sidebar uses logical `border-e`; mobile drawer + skip link use logical `start-` |
| **Tables** | 🟢 | `TH`/`TD` use `text-start`; no physical alignment |
| **Forms** | 🟢 | `Field` + inputs direction-neutral; explicit `dir="rtl"` on Arabic-name inputs and `dir="ltr"` on numeric/id/date inputs (19 deliberate overrides) — correct mixed-content handling |
| **Dialogs / Drawers** | 🟢 | `Drawer` anchors to a **logical** edge (`start`/`end`) so it mirrors; `Dialog` is centered (direction-neutral) |
| **Charts** | 🟢 (n/a) | no charting library; the dashboard bar uses width-% fills (direction-agnostic) |
| **Combobox/Tabs** | 🟢 | `EntityPicker` dropdown uses logical `start`; `Tabs` arrow-key nav is **RTL-aware** (reverses with `document.dir`) |

## Verdict
RTL is **fully compliant**. The earlier audit’s physical-class concerns have been eliminated through the component consolidation and sweeps (Phases 3–11); remaining `dir="…"` attributes are intentional mixed-content overrides, which is correct per the DS RTL guidance.

## Verification
- ✅ grep: 0 physical-direction utility classes in `app/` + `components/`
- ✅ direction toggles live with the EN/AR switcher
- ✅ build (36/36)

**Recommendation:** a manual visual pass in Arabic (toggle to AR) across dialogs/tables to confirm pixel-level mirroring — no code changes anticipated.

**STOP — Phase 12 complete.** Proceeding to Phase 13 (Dark Mode).
