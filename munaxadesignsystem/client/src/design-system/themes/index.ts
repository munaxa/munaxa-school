/**
 * The colour schemes this site can render.
 *
 * Colour itself is NOT defined here: the site consumes the Munaxa palette from the shared
 * platform (`@import "@axa/platform/css/themes/school"` in index.css), and every component
 * styles itself through that theme contract. This module carries only the scheme *name*, which
 * `ThemeProvider` uses to toggle the `.dark` class.
 *
 * A previous revision derived this type from a local copy of the design tokens
 * (`design-system/tokens/*`). That copy had drifted from the shipped palette and had no runtime
 * consumers, so it was removed — see /PLATFORM_ENGINEERING_STANDARDS.md §6.
 */
export type ThemeName = 'light' | 'dark';
