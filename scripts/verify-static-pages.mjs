/** G27 — Team VH and Sondage render with their own single h1. */
import { withServer, getHtml, stripScripts, assert, assertEqual, ok } from './lib/harness.mjs'

const PAGES = [
  { path: '/rafik-lahlou-team-vh/', mustContain: 'Rafik Lahlou' },
  { path: '/sondage/', mustContain: 'Sondage' },
]

await withServer(async (baseUrl) => {
  for (const page of PAGES) {
    const res = await getHtml(`${baseUrl}${page.path}`)
    assertEqual(res.status, 200, `${page.path} status`)
    const html = stripScripts(res.html)

    const h1 = [...html.matchAll(/<h1\b/gi)]
    assertEqual(h1.length, 1, `exactly one <h1> on ${page.path}`)
    assert(
      html.includes(page.mustContain),
      `${page.path} does not mention "${page.mustContain}" — wrong page rendered?`,
    )
    console.error(`  ${page.path} ok`)
  }
})

ok('STATICPAGES_OK')
