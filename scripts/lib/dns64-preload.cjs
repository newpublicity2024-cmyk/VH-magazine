/**
 * Loaded into a gate's `next start` only (NODE_OPTIONS=--require), and only when the gate has
 * measured that it is needed (see verify-launch-media-direct.mjs).
 *
 * This Mac's network runs DNS64: a host with only IPv4 addresses ALSO resolves to a synthesised
 * NAT64 address in 64:ff9b::/96 (35.180.16.12 → 64:ff9b::23b4:100c). Next's in-process image
 * optimizer refuses any upstream that resolves to an address its isPrivateIp() lists — that
 * prefix included — so every remote image fails locally with '"url" parameter is not allowed'
 * (measured 2026-11-17: our Blob store refused, i.ytimg.com — no synthesised address — served).
 *
 * This drops exactly the synthesised addresses whose embedded IPv4 the same lookup also
 * returned: the answer a network without DNS64 gives. Nothing else changes — the allow-list
 * match, the private-IP guard for any real private address, and every other lookup.
 */
const dns = require('node:dns')

const original = dns.promises.lookup

function embeddedIPv4(address) {
  const m = /^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address)
  if (!m) return null
  const hi = parseInt(m[1], 16)
  const lo = parseInt(m[2], 16)
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.')
}

dns.promises.lookup = async function lookup(hostname, options) {
  const result = await original.call(this, hostname, options)
  if (!Array.isArray(result)) return result
  const v4 = new Set(result.filter((r) => r.family === 4).map((r) => r.address))
  return result.filter((r) => r.family !== 6 || !v4.has(embeddedIPv4(r.address)))
}
