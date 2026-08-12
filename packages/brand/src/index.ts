/**
 * Munaxa School's brand surface.
 *
 * The `Logo` that used to live here is gone. It was a fourth implementation of the same idea —
 * a variant map, a ratio table, a light/dark file swap — and it pointed at the corporate
 * `munaxa-*.png` assets with the alt text "Munaxa", so every School screen was labelled with the
 * company's name rather than the product's. The approved `munaxa. school` artwork now ships with
 * `@munaxa/platform`, and `ProductLogo` renders it:
 *
 *   import { ProductLogo } from '@munaxa/ui';
 *
 * What stays here is the part that is genuinely School's and genuinely not a picture: the
 * wordmark set as *text*, for running copy where an image would be wrong.
 */
export { Wordmark } from './wordmark.js';
