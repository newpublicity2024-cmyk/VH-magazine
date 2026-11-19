/**
 * G40 — every internal link in the top bar, primary nav and footer actually
 * resolves.
 *
 * G12 proves the links SAY what spec §4 lists; it never requested them. That is
 * how "Grand Angle" (/vh-grand-angle-2/) and "KIT MEDIA" (/kit-media.pdf) shipped
 * as 404s behind a green G12. This gate requests every one.
 *
 * Resolves means: 200 directly, or ONE redirect whose target answers 200. A
 * same-site target is requested on this server; a cross-site target (a legacy
 * upload handed to the old origin or to Blob) is requested where it points,
 * because that is where the reader's browser goes.
 */
import http from 'node:http'

import { withServer, getHtml, stripScripts, sectionHtml, elementHtml, assert, fail, ok } from './lib/harness.mjs'

/** Raw request with no redirect following, so the first hop is observable. */
function requestOnce(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      res.resume()
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location ?? null }))
    })
    req.on('error', reject)
    req.end()
  })
}

/** Final status of a cross-site URL, following its own redirects. */
async function remoteStatus(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(30_000) })
      await res.body?.cancel()
      return res.status
    } catch (err) {
      if (attempt >= 3) return `network error: ${err.message}`
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
}

/** Every <a> in a fragment as { href, label }. */
const anchors = (fragment) =>
  [...fragment.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({
    href: m[1].replace(/&amp;/g, '&'),
    label: m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
  }))

await withServer(async (baseUrl) => {
  const { status, html: raw } = await getHtml(`${baseUrl}/`)
  assert(status === 200, `homepage status ${status}`)
  const html = stripScripts(raw)

  const scopes = {
    'top bar': elementHtml(html, 'data-nav', 'topbar'),
    'primary nav': elementHtml(html, 'data-nav', 'primary'),
    footer: sectionHtml(html, 'footer'),
  }
  const links = new Map() // href -> labels
  for (const [name, fragment] of Object.entries(scopes)) {
    assert(fragment, `${name} not found in the homepage HTML`)
    for (const { href, label } of anchors(fragment)) {
      // Internal = a same-site path. External partner sites are not ours to gate.
      if (!href.startsWith('/') || href.startsWith('//')) continue
      if (!links.has(href)) links.set(href, new Set())
      links.get(href).add(`${name}: ${label}`)
    }
  }

  // Vacuity guard: the two links this gate exists for must be among those checked.
  const labelled = (re) => [...links.values()].some((ls) => [...ls].some((l) => re.test(l)))
  assert(labelled(/Grand Angle/i), 'the Grand Angle link was not found among the internal nav links')
  assert(labelled(/KIT MEDIA/i), 'the KIT MEDIA link was not found among the internal nav links')
  assert(links.size >= 10, `only ${links.size} internal links found — the scoping is broken`)

  const failures = []
  for (const [href, labels] of links) {
    const first = await requestOnce(`${baseUrl}${href}`)
    let verdict = null
    if (first.status === 200) verdict = 'ok'
    else if ([301, 302, 307, 308].includes(first.status) && first.location) {
      const target = new URL(first.location, `${baseUrl}${href}`)
      const sameSite = target.origin === new URL(baseUrl).origin
      const finalStatus = sameSite
        ? (await requestOnce(target.href)).status
        : await remoteStatus(target.href)
      verdict = finalStatus === 200 ? 'ok' : `${first.status} -> ${target.href} -> ${finalStatus}`
    } else verdict = `status ${first.status}`

    if (verdict !== 'ok') failures.push(`${href} [${[...labels].join(' | ')}]: ${verdict}`)
    else console.error(`  ok ${first.status} ${href}`)
  }

  if (failures.length) fail(`${failures.length} of ${links.size} internal nav links do not resolve:\n  ${failures.join('\n  ')}`)
  console.error(`  ${links.size} internal links in top bar, primary nav and footer all resolve`)
})

ok('NAVRESOLVE_OK')
