import type { MetadataRoute } from 'next';

/**
 * The admin portal is a fully authenticated School OS with no public content. It must
 * never appear in search results, so every path is disallowed and no sitemap is exposed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
