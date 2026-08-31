/** G32 — RSS is well-formed and its links are absolute production URLs (B2). */
import { withServer, getHtml, assert, assertEqual, ok, loadEnv } from './lib/harness.mjs'

const env = loadEnv()
const ORIGIN = (env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '')
const ARTICLE_RE = new RegExp(`^${ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[a-z0-9-]+(/[a-z0-9-]+)?/[a-z0-9-]+/$`)

await withServer(async (baseUrl) => {
  const res = await getHtml(`${baseUrl}/rss.xml`)
  assertEqual(res.status, 200, 'rss.xml status')
  const xml = res.html

  assert(xml.startsWith('<?xml'), 'rss.xml does not begin with an XML declaration')
  assert(/<rss[^>]+version="2\.0"/.test(xml), 'rss.xml is not declared as RSS 2.0')
  assert(/<channel>/.test(xml) && /<\/channel>/.test(xml), 'rss.xml has no channel element')

  // Tag balance is a cheap well-formedness proxy that catches unescaped content.
  for (const tag of ['item', 'title', 'link']) {
    const open = (xml.match(new RegExp(`<${tag}>`, 'g')) || []).length
    const close = (xml.match(new RegExp(`</${tag}>`, 'g')) || []).length
    assertEqual(open, close, `unbalanced <${tag}> tags in rss.xml (unescaped content?)`)
  }

  const items = (xml.match(/<item>/g) || []).length
  assert(items > 0, 'rss.xml contains no items')

  const links = [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map((m) => m[1])
  assertEqual(links.length, items, 'every item must carry a <link>')

  const bad = links.filter((l) => !ARTICLE_RE.test(l))
  assertEqual(bad.length, 0, `RSS links that are not absolute article URLs on ${ORIGIN}: ${JSON.stringify(bad.slice(0, 3))}`)

  // A guid that is not the permalink breaks reader de-duplication on rename.
  const guids = [...xml.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map((m) => m[1])
  assertEqual(guids.length, items, 'every item must carry a <guid>')
  assertEqual(JSON.stringify(guids), JSON.stringify(links), 'each guid must equal its item link')

  assert(/<atom:link[^>]+rel="self"/.test(xml), 'rss.xml is missing the atom:link rel="self" element')

  console.error(`  ${items} items, all links absolute on ${ORIGIN}`)
})

ok('RSS_OK')
