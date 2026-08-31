/**
 * G39 — host-based staging noindex (amendment B3).
 *
 * Both directions are asserted. A checker that only confirmed the header is
 * present on a foreign host would also pass on a site that sends noindex to
 * everyone — which would silently de-index production at cutover. The
 * Host: www.vh.ma case is the control that rules that out.
 */
import http from 'node:http'

import { withServer, assert, assertEqual, ok } from './lib/harness.mjs'

/**
 * Raw http.request rather than fetch: undici treats `Host` as a forbidden
 * header and silently substitutes the real one, so a fetch-based check would
 * measure 127.0.0.1 every time and could never observe the production case.
 */
function headOf(baseUrl, path, host) {
  const { hostname, port } = new URL(baseUrl)
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname, port, path, method: 'GET', headers: { host } },
      (res) => {
        res.resume()
        resolve(res.headers['x-robots-tag'] ?? null)
      },
    )
    req.on('error', reject)
    req.end()
  })
}

const FOREIGN = ['vh-preview-abc123.vercel.app', 'localhost:3111', 'staging.example.com']
const PRODUCTION = ['www.vh.ma', 'vh.ma']
const PATHS = ['/', '/category/moteur/', '/moteur/vh-moteur/porsche-licone-sous-pression/']

await withServer(async (baseUrl) => {
  const robotsTag = (path, host) => headOf(baseUrl, path, host)

  for (const host of FOREIGN) {
    const tag = await robotsTag('/', host)
    assert(
      tag && /noindex/i.test(tag),
      `Host: ${host} must receive X-Robots-Tag noindex — measured ${JSON.stringify(tag)}`,
    )
  }

  // Control: production hosts must NOT be marked noindex, on every page type.
  for (const host of PRODUCTION) {
    for (const path of PATHS) {
      const tag = await robotsTag(path, host)
      assertEqual(
        tag,
        null,
        `Host: ${host} ${path} must NOT carry X-Robots-Tag — a blanket noindex would de-index production at cutover`,
      )
    }
  }

  console.error(`  ${FOREIGN.length} foreign hosts -> noindex; ${PRODUCTION.length} production hosts x ${PATHS.length} paths -> absent`)
})

ok('NOINDEX_OK')
