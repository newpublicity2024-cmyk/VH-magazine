import { getAllPublishedArticles } from '@/lib/queries'
import { articleUrl } from '@/lib/routes'
import { SITE } from '@/lib/site'
import { absoluteUrl } from '@/lib/seo'

/**
 * Google News sitemap. Per Google's spec — and the round-2a rider — this
 * contains ONLY articles published in the last 48 hours. Including older items
 * is a spec violation that gets the whole feed ignored, so the window is not
 * a tuning knob.
 */
/*
 * Rendered on demand, not prerendered.
 *
 * Two reasons. A feed frozen at build time misrepresents a news site — the
 * 48-hour news window in particular would be pinned to whenever the deploy ran.
 * And prerendering forced the build to reach the database, which is what made a
 * Vercel build fail outright when env vars were absent.
 *
 * Cost is bounded by the CDN cache header below rather than by ISR.
 */
export const dynamic = 'force-dynamic'

const WINDOW_MS = 48 * 60 * 60 * 1000

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET() {
  const articles = await getAllPublishedArticles()
  const cutoff = Date.now() - WINDOW_MS

  const recent = articles.filter((a) => {
    if (!a.publishedAt) return false
    const t = new Date(a.publishedAt).getTime()
    return Number.isFinite(t) && t >= cutoff
  })

  const entries = recent.map((a) =>
    [
      '  <url>',
      `    <loc>${escape(absoluteUrl(articleUrl(a as never)))}</loc>`,
      '    <news:news>',
      '      <news:publication>',
      `        <news:name>${escape(SITE.name)}</news:name>`,
      '        <news:language>fr</news:language>',
      '      </news:publication>',
      `      <news:publication_date>${new Date(a.publishedAt as string).toISOString()}</news:publication_date>`,
      `      <news:title>${escape(a.title)}</news:title>`,
      '    </news:news>',
      '  </url>',
    ].join('\n'),
  )

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries.join('\n')}
</urlset>`

  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, s-maxage=600, stale-while-revalidate=1200' } })
}
