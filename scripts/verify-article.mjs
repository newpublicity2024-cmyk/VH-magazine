/**
 * G20 — the article page renders its required parts (spec §7).
 * Asserts on the DOM, not the RSC payload (harness strips <script>).
 */
import { withServer, getHtml, stripScripts, assert, assertEqual, ok } from './lib/harness.mjs'

const PATH = '/moteur/vh-moteur/porsche-licone-sous-pression/'

await withServer(async (baseUrl) => {
  const { status, html: raw } = await getHtml(`${baseUrl}${PATH}`)
  assertEqual(status, 200, `article ${PATH} status`)
  const html = stripScripts(raw)

  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
  assertEqual(h1.length, 1, 'exactly one <h1> on the article page')
  assert(/Porsche/i.test(h1[0][1]), `the h1 must be the article title — measured "${h1[0][1].replace(/<[^>]+>/g,'').trim().slice(0,60)}"`)

  assert(/data-breadcrumbs/.test(html), 'no breadcrumb trail (data-breadcrumbs)')
  assert(/data-share/.test(html), 'no share buttons (data-share)')
  assert(/data-article-body/.test(html), 'no rendered rich-text body (data-article-body)')

  const dates = [...html.matchAll(/<time[^>]*data-date[^>]*>([^<]*)<\/time>/gi)].map((m) => m[1].trim())
  assert(dates.length > 0, 'no data-date element on the article page')
  const bad = dates.filter((d) => d && !/^\d{2}\/\d{2}\/\d{4}$/.test(d))
  assertEqual(bad.length, 0, `article dates not in DD/MM/YYYY: ${JSON.stringify(bad.slice(0, 3))}`)

  // Breadcrumb must reflect the nested chain, not just the leaf.
  const crumbs = html.match(/data-breadcrumbs[\s\S]*?<\/nav>/i)?.[0] || ''
  assert(/Accueil/.test(crumbs), 'breadcrumb is missing the Accueil root')
  assert(/href="\/category\/moteur\/"/.test(crumbs), 'breadcrumb is missing the parent category link')

  console.error(`  h1 ok, breadcrumbs ok, ${dates.length} date(s), body + share present`)
})

ok('ARTICLE_OK')
