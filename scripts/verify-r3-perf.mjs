/**
 * R3-G10 — the round-3 finish stays inside the performance budget (DESIGN-SPEC-R3 §8).
 *
 *  1. First-party JS on the home and article pages grows by at most 15 KB gzipped over
 *     the pre-round-3 build. "First-party JS" is every script the page actually loads
 *     from /_next/static/, measured as gzip -9 of the bytes received — the files a
 *     reader downloads, not a guess from the build manifest.
 *  2. Lighthouse mobile performance (default mobile emulation, simulated throttling)
 *     is ≥ 90 on home, article and category: the median of three runs per page, so one
 *     noisy run can neither pass nor fail the gate on its own.
 *
 * `--record-baseline` measures the CURRENT build and writes scripts/r3-baseline.json
 * with the commit it was measured on. It was run once, on the untouched round-2b
 * build, before any round-3 code existed. The check refuses a baseline taken on a
 * commit that contains round-3 work (one whose tree has the round-3 token marker).
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import { withBrowser } from './lib/browser.mjs'
import { assert, fail, ok, ROOT } from './lib/harness.mjs'

const BASELINE = path.join(ROOT, 'scripts', 'r3-baseline.json')
const RECORD = process.argv.includes('--record-baseline')
const JS_BUDGET_BYTES = 15 * 1024
const LH_MIN = 90
const LH_RUNS = 3

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

/** Load `url`, collect every first-party script response, return total gzip bytes. */
async function firstPartyJs(page, url) {
  const bodies = new Map()
  page.on('response', async (res) => {
    const u = new URL(res.url())
    if (!u.pathname.startsWith('/_next/static/') || !u.pathname.endsWith('.js')) return
    try {
      bodies.set(u.pathname, await res.body())
    } catch {
      /* redirected or aborted — not downloaded */
    }
  })
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 })
  // Lazy chunks (client islands) arrive after load; give them time to land.
  await page.waitForTimeout(2500)
  let total = 0
  for (const body of bodies.values()) total += gzipSync(body, { level: 9 }).length
  assert(bodies.size > 0, `no first-party scripts captured on ${url} — the measurement is vacuous`)
  return { gz: total, files: bodies.size }
}

async function lighthouseScore(url, chromePath) {
  const { default: lighthouse } = await import('lighthouse')
  const chromeLauncher = await import('chrome-launcher')
  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless=new', '--no-first-run', '--disable-gpu'],
  })
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      onlyCategories: ['performance'],
      output: 'json',
      logLevel: 'error',
    })
    const lhr = result.lhr
    if (lhr.runtimeError) fail(`lighthouse runtime error on ${url}: ${lhr.runtimeError.message}`)
    return {
      score: Math.round(lhr.categories.performance.score * 100),
      lcp: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
      cls: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
      tbt: Math.round(lhr.audits['total-blocking-time'].numericValue),
    }
  } finally {
    await chrome.kill()
  }
}

const { chromium } = await import('@playwright/test')
const chromePath = chromium.executablePath()

const measured = await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const p = await page({ width: 390, height: 844 })
  await p.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  const articleHref = await p
    .locator('[data-section="actu"] [data-card] a[href]')
    .first()
    .getAttribute('href')
  assert(articleHref, 'could not find an Actu article link to measure the article page')
  await p.context().close()

  const urls = {
    home: `${baseUrl}/`,
    article: `${baseUrl}${articleHref}`,
    category: `${baseUrl}/category/actualite-news-express-maroc/`,
  }

  const js = {}
  for (const key of ['home', 'article']) {
    const pg = await page({ width: 390, height: 844 })
    js[key] = await firstPartyJs(pg, urls[key])
    await pg.context().close()
    console.error(`  js ${key}: ${js[key].gz} B gz across ${js[key].files} files`)
  }

  const lh = {}
  for (const [key, url] of Object.entries(urls)) {
    const runs = []
    for (let i = 0; i < LH_RUNS; i += 1) runs.push(await lighthouseScore(url, chromePath))
    lh[key] = { score: median(runs.map((r) => r.score)), runs }
    console.error(
      `  lighthouse ${key}: median ${lh[key].score} (runs ${runs.map((r) => r.score).join('/')}; ` +
        `lcp ${runs.map((r) => r.lcp).join('/')} ms; cls ${runs.map((r) => r.cls).join('/')}; ` +
        `tbt ${runs.map((r) => r.tbt).join('/')} ms)`,
    )
  }

  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
  return { js, lh, articleHref }
})

if (RECORD) {
  const sha = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
  const dirty = execSync('git status --porcelain -- src', { cwd: ROOT, encoding: 'utf8' }).trim()
  assert(!dirty, `refusing to record a baseline with uncommitted changes under src/:\n${dirty}`)
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note: 'Pre-round-3 build. Recorded by verify-r3-perf.mjs --record-baseline; do not edit.',
        sha,
        measuredAt: new Date().toISOString(),
        js: { home: measured.js.home.gz, article: measured.js.article.gz },
        lighthouse: Object.fromEntries(Object.entries(measured.lh).map(([k, v]) => [k, v.score])),
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`baseline recorded at ${sha}`)
  ok('R3_BASELINE_RECORDED')
} else {
  check()
}

// ok() exits only once stdout has flushed, so code after it still runs: the check lives
// in its own function and is reached only through the else branch above.
function check() {
  assert(
    existsSync(BASELINE),
    'scripts/r3-baseline.json is missing — record the pre-round-3 baseline first',
  )
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
  // The baseline commit must predate round-3 code: its styles.css must not carry the
  // round-3 token marker. Guards against someone re-recording the baseline on top of
  // the redesign to make the growth check pass.
  const baselineCss = execSync(`git show ${baseline.sha}:'src/app/(frontend)/styles.css'`, {
    cwd: ROOT,
    encoding: 'utf8',
  })
  assert(
    !baselineCss.includes('round-3 tokens'),
    `baseline ${baseline.sha} already contains round-3 tokens — it is not a pre-round-3 baseline`,
  )

  for (const key of ['home', 'article']) {
    const growth = measured.js[key].gz - baseline.js[key]
    assert(
      growth <= JS_BUDGET_BYTES,
      `first-party JS on ${key} grew by ${growth} B gz (baseline ${baseline.js[key]} B at ${baseline.sha.slice(0, 7)}, ` +
        `now ${measured.js[key].gz} B) — budget is ${JS_BUDGET_BYTES} B`,
    )
    console.error(`  js growth ${key}: ${growth} B gz (budget ${JS_BUDGET_BYTES})`)
  }
  for (const [key, { score }] of Object.entries(measured.lh)) {
    assert(
      score >= LH_MIN,
      `Lighthouse mobile performance on ${key} is ${score} (median of ${LH_RUNS}) — needs ≥ ${LH_MIN}`,
    )
  }

  ok('R3_PERF_OK')
}
