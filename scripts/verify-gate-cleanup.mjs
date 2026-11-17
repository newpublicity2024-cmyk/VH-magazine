/**
 * G43 — a database-writing gate that fails still cleans up.
 *
 * G19, G34 and G35 write throwaway rows into vh_magazine. Each is run here with
 * GATE_INJECT_FAILURE set to every stage it supports — "driver" (the Payload child dies
 * after creating and renaming, before it reports) and "assert" (every row exists and the
 * checks have run) — and must:
 *   1. exit non-zero, naming the injected failure (so the failure path really ran);
 *   2. have created rows: the id sequences of its tables advanced during the run
 *      (sequences never roll back, so this holds even though the rows are gone);
 *   3. leave nothing: no article, article version or redirect carrying that gate's
 *      stamp, and no orphaned article version.
 * All three are measured here with this script's own queries, never from the gate's output.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { ok, fail, pgClient, ROOT } from './lib/harness.mjs'

const RUNS = [
  { gate: 'G19', script: 'verify-redirects.mjs', stage: 'driver', creates: 'articles' },
  { gate: 'G19', script: 'verify-redirects.mjs', stage: 'assert', creates: 'articles' },
  { gate: 'G34', script: 'verify-middleware.mjs', stage: 'assert', creates: 'redirects' },
  { gate: 'G35', script: 'verify-rename-cycle.mjs', stage: 'driver', creates: 'articles' },
  { gate: 'G35', script: 'verify-rename-cycle.mjs', stage: 'assert', creates: 'articles' },
]
const PATTERNS = {
  G19: { slug: '^g19-', path: '/g19-' },
  G34: { slug: '^g34-', path: '^/g34-' },
  G35: { slug: '^g35-', path: '/g35-' },
}

const measure = async (gate) => {
  const c = await pgClient()
  try {
    const { slug, path: p } = PATTERNS[gate]
    const { rows } = await c.query(
      `select (select last_value from articles_id_seq)::bigint as articles_seq,
              (select last_value from redirects_id_seq)::bigint as redirects_seq,
              (select count(*) from articles where slug ~ $1)::int as articles,
              (select count(*) from _articles_v where version_slug ~ $1)::int as versions,
              (select count(*) from _articles_v where parent_id is null)::int as orphans,
              (select count(*) from redirects where "from" ~ $2 or "to" ~ $2)::int as redirects`,
      [slug, p],
    )
    return rows[0]
  } finally {
    await c.end()
  }
}

const lines = []
for (const run of RUNS) {
  const before = await measure(run.gate)
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', run.script)], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, GATE_INJECT_FAILURE: run.stage },
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300000,
  })
  const after = await measure(run.gate)
  const out = `${r.stdout}\n${r.stderr}`
  const label = `${run.gate} ${run.stage}`

  if (r.status === 0) fail(`${label}: exited 0 although a failure was injected`)
  if (!out.includes(`injected failure at "${run.stage}"`)) {
    fail(
      `${label}: exited ${r.status ?? r.signal} without the injected failure — it failed elsewhere:\n${out.slice(-1500)}`,
    )
  }
  const seq = `${run.creates}_seq`
  if (!(Number(after[seq]) > Number(before[seq]))) {
    fail(
      `${label}: ${run.creates}_id_seq did not advance (${before[seq]} → ${after[seq]}) — the run created nothing, so its cleanup was never tested`,
    )
  }
  const left = {
    articles: after.articles,
    versions: after.versions,
    orphans: after.orphans,
    redirects: after.redirects,
  }
  if (Object.values(left).some((n) => n > 0)) {
    fail(`${label}: the failed run left ${JSON.stringify(left)} in vh_magazine`)
  }
  lines.push(
    `  ${label}: exit ${r.status}, injected failure reported, ${seq} ${before[seq]} → ${after[seq]}, left ${JSON.stringify(left)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
  )
}
console.error(lines.join('\n'))
ok('GATE_CLEANUP_OK')
