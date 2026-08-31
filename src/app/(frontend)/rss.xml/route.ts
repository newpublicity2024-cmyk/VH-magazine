import { getAllPublishedArticles } from '@/lib/queries'
import { articleUrl } from '@/lib/routes'
import { absoluteUrl, SITE_URL } from '@/lib/seo'
import { SITE } from '@/lib/site'

/** RSS 2.0 feed (spec §9). Absolute vh.ma links per amendment B2. */
export const revalidate = 900

const LIMIT = 50

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET() {
  const articles = (await getAllPublishedArticles()).slice(0, LIMIT)

  const items = articles.map((a) => {
    const link = absoluteUrl(articleUrl(a as never))
    return [
      '    <item>',
      `      <title>${escape(a.title)}</title>`,
      `      <link>${escape(link)}</link>`,
      // The permalink is the identity: a slug change repoints the URL, and a
      // stable guid keeps readers from re-showing an article they already saw.
      `      <guid isPermaLink="true">${escape(link)}</guid>`,
      a.excerpt ? `      <description>${escape(a.excerpt)}</description>` : '',
      a.publishedAt ? `      <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>` : '',
      '    </item>',
    ]
      .filter(Boolean)
      .join('\n')
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(SITE.name)}</title>
    <link>${escape(SITE_URL)}/</link>
    <description>${escape(SITE.description)}</description>
    <language>fr-FR</language>
    <atom:link href="${escape(SITE_URL)}/rss.xml" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>`

  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
}
