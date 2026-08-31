import { getAllCategories, getAllIssues, getAllPublishedArticles } from '@/lib/queries'
import { articleUrl, categoryUrl, issueUrl, STATIC_ROUTES } from '@/lib/routes'
import { absoluteUrl } from '@/lib/seo'

/**
 * sitemap.xml as a route handler rather than Next's MetadataRoute helper: the
 * helper cannot emit a trailing slash reliably, and every URL here must match
 * the served address byte-for-byte or the sitemap advertises redirects.
 *
 * Amendment B2: absoluteUrl() is pinned to NEXT_PUBLIC_SERVER_URL, so the
 * sitemap says https://www.vh.ma even while the site runs on a Vercel preview
 * host. Nothing here changes at cutover.
 */
export const revalidate = 3600

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function urlEntry(loc: string, lastmod?: string | null, priority?: string) {
  return [
    '  <url>',
    `    <loc>${escape(loc)}</loc>`,
    lastmod ? `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : '',
    priority ? `    <priority>${priority}</priority>` : '',
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function GET() {
  const [articles, categories, issues] = await Promise.all([
    getAllPublishedArticles(),
    getAllCategories(),
    getAllIssues(),
  ])

  const entries: string[] = [
    urlEntry(absoluteUrl('/'), null, '1.0'),
    urlEntry(absoluteUrl(STATIC_ROUTES.lesUnes), null, '0.6'),
    urlEntry(absoluteUrl(STATIC_ROUTES.vhTv), null, '0.6'),
    urlEntry(absoluteUrl(STATIC_ROUTES.contact), null, '0.3'),
    urlEntry(absoluteUrl(STATIC_ROUTES.teamVh), null, '0.3'),
    urlEntry(absoluteUrl(STATIC_ROUTES.sondage), null, '0.3'),
  ]

  for (const c of categories) entries.push(urlEntry(absoluteUrl(categoryUrl(c as never)), null, '0.5'))
  for (const i of issues) entries.push(urlEntry(absoluteUrl(issueUrl(i)), i.publishedAt, '0.5'))
  for (const a of articles) {
    entries.push(urlEntry(absoluteUrl(articleUrl(a as never)), a.updatedAt || a.publishedAt, '0.8'))
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  })
}
