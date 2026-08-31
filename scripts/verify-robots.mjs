/** G33 — robots.txt (spec §2) with an absolute production sitemap URL (B2). */
import { withServer, getHtml, assert, assertEqual, ok, loadEnv } from './lib/harness.mjs'

const env = loadEnv()
const ORIGIN = (env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '')

await withServer(async (baseUrl) => {
  const res = await getHtml(`${baseUrl}/robots.txt`)
  assertEqual(res.status, 200, 'robots.txt status')
  const txt = res.html

  assert(/User-Agent:\s*\*/i.test(txt), 'robots.txt has no wildcard User-Agent rule')
  assert(/^Allow:\s*\/$/im.test(txt), 'robots.txt does not Allow: /')

  const sitemapLine = /^Sitemap:\s*(\S+)$/im.exec(txt)
  assert(sitemapLine, 'robots.txt has no Sitemap: line')
  assertEqual(
    sitemapLine[1],
    `${ORIGIN}/sitemap.xml`,
    'the Sitemap line must be absolute on the production origin, never the deployment host (B2)',
  )

  // The advertised sitemap must actually exist.
  const sm = await getHtml(`${baseUrl}/sitemap.xml`)
  assertEqual(sm.status, 200, 'the sitemap advertised by robots.txt must resolve')

  // Search results are thin and infinite; the admin is not for crawlers.
  assert(/^Disallow:\s*\/recherche/im.test(txt), 'robots.txt should disallow /recherche')
  assert(/^Disallow:\s*\/admin/im.test(txt), 'robots.txt should disallow /admin')

  console.error(`  sitemap -> ${sitemapLine[1]}`)
})

ok('ROBOTS_OK')
