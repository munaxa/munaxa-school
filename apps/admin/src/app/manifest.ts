import type { MetadataRoute } from 'next';

import { brandManifest } from '@munaxa/ui';

/**
 * The web app manifest — what an installed Munaxa School looks like on a home screen.
 *
 * Built from the brand registry, so the installed icon is the approved School app icon the tab
 * already shows and the chrome colour is the same teal the theme paints. A hand-written manifest
 * is where a corporate icon quietly outlives a product's rebrand, because nothing renders it in
 * review.
 */
export default function manifest(): MetadataRoute.Manifest {
  return brandManifest(
    'school',
    'Munaxa: a multi-tenant School Operating System for K-12 schools.',
  ) as MetadataRoute.Manifest;
}
