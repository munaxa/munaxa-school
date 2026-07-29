import type { MetadataRoute } from 'next';
import { DEMO_SITE_URL } from '@/lib/seo';

/** Only the public, indexable demo pages belong in the sitemap. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${DEMO_SITE_URL}/request-demo`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
