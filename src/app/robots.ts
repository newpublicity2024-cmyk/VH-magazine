import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/seo'

/**
 * robots.txt (spec §2: "index, follow, max-image-preview:large").
 *
 * The Sitemap line is absolute on SITE_URL, not the deployment host (amendment
 * B2) — a preview deployment advertising its own sitemap would invite Google to
 * crawl the staging domain.
 *
 * Note this does NOT gate indexing of the staging host; that is done with an
 * X-Robots-Tag header in middleware (B3), which robots.txt cannot express and
 * which works even if a crawler ignores this file.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Search result pages are thin and infinite in variety; the admin and
        // API surface has nothing a crawler should see.
        disallow: ['/admin', '/api/', '/recherche'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
