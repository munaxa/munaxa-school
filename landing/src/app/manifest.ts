import type { MetadataRoute } from 'next';
import { SITE_NAME, THEME_COLOR_LIGHT } from '@/lib/site';

/** Web app manifest — installability + applicationName/theme metadata. Icons resolve to the
 * official Munaxa "m." mark served from `app/icon.png`. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — School Operating System`,
    short_name: SITE_NAME,
    description:
      'The School Operating System that connects every department in a K-12 school onto one platform.',
    start_url: '/',
    display: 'standalone',
    // Raw hex consumed by the manifest JSON (not a Tailwind class), so the token rule
    // does not apply here.
    // eslint-disable-next-line no-restricted-syntax
    background_color: '#ffffff',
    theme_color: THEME_COLOR_LIGHT,
    icons: [{ src: '/icon.png', type: 'image/png', sizes: 'any' }],
  };
}
