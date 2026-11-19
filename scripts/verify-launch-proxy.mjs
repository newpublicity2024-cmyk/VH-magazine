/**
 * GATES-LAUNCH L3 — the request interceptor uses Next 16's `proxy` file convention.
 *
 * Next 16 deprecated `middleware.ts` (renamed `proxy.ts`, Node.js runtime only) and says so on
 * every build. This gate requires the rename to be complete and behaviour-neutral at the
 * source level — `src/proxy.ts` exports `proxy`, its matcher is byte-for-byte the matcher the
 * middleware had, and no `src/middleware.ts` is left for Next to find (both present is a build
 * error) — then runs the real production build and requires it to succeed, to list the proxy
 * in its route table, and to print no deprecation warning. What the interceptor DOES is gated
 * elsewhere and re-run after this change: G34, G39, G40 here, and the migration ledgers P4
 * (legacy uploads) and P5-import G4 (`/?p=` and tag redirects) on the real data.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { ROOT, assert, fail, ok } from './lib/harness.mjs'

// The matcher as it stood in src/middleware.ts before the rename (commit e34f9a1).
const MATCHER =
  "'/((?!_next/static|_next/image|favicon\\\\.ico|admin|api/|redirects-map\\\\.json|sitemap\\\\.xml|news-sitemap\\\\.xml|rss\\\\.xml|robots\\\\.txt).*)'"

// What Next 16.2.6 printed for this repo before the rename (a 2026-11-17 build log):
//   ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: …
const DEPRECATION = /"middleware" file convention is deprecated/i
const SAMPLE =
  '⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy'
assert(DEPRECATION.test(SAMPLE), 'control: the deprecation pattern does not match the warning Next prints')

const middleware = path.join(ROOT, 'src', 'middleware.ts')
const proxy = path.join(ROOT, 'src', 'proxy.ts')
assert(!existsSync(middleware), 'src/middleware.ts still exists')
assert(existsSync(proxy), 'src/proxy.ts does not exist')

const source = readFileSync(proxy, 'utf8')
assert(/export\s+(async\s+)?function\s+proxy\s*\(/.test(source), 'src/proxy.ts does not export a function named proxy')
assert(!/export\s+(async\s+)?function\s+middleware\s*\(/.test(source), 'src/proxy.ts still exports middleware')
assert(!/export\s+const\s+runtime\b/.test(source), 'src/proxy.ts sets runtime (Next 16 rejects it in a proxy)')
const matcher = /matcher:\s*\[\s*('[^']*')\s*,?\s*\]/.exec(source)?.[1]
assert(matcher === MATCHER, `proxy matcher changed — expected ${MATCHER}, found ${matcher}`)

const build = spawnSync('pnpm', ['run', 'build'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  timeout: 20 * 60 * 1000,
})
const log = `${build.stdout ?? ''}${build.stderr ?? ''}`
if (build.status !== 0) {
  fail(`build exited ${build.status ?? build.signal}:\n${log.slice(-3000)}`)
}
const warned = log.split('\n').find((l) => DEPRECATION.test(l))
assert(!warned, `the build still warns: ${warned?.trim()}`)
assert(/ƒ Proxy\b/.test(log), 'the build route table lists no Proxy — the interceptor was not compiled in')

console.error('  src/proxy.ts exports proxy with the pinned matcher; build OK, proxy compiled, no deprecation warning')
ok('LAUNCH_PROXY_OK')
