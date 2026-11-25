/**
 * A ledger re-run after the latest change, with exactly the expected open gates.
 *
 *   node scripts/verify-ledger-fresh.mjs <LEDGER.md> [--unmet ID,ID] [--abandoned ID,ID]
 *
 * Reads the ledger through the unlazy checker's --status (which executes nothing) and requires:
 *   - the unmet gates to be exactly --unmet, the abandoned exactly --abandoned, every other gate met;
 *   - the ledger written after every tracked source file changed (src/, scripts/, config): a ledger
 *     whose evidence predates the code would be stale green.
 * Ledgers are local (git-ignored); this only reads them.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { assert, fail, ok, ROOT } from './lib/harness.mjs'

const ledger = process.argv[2]
const listOf = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1].split(',').filter(Boolean).sort() : []
}
if (!ledger) fail('usage: verify-ledger-fresh.mjs <LEDGER.md> [--unmet IDS] [--abandoned IDS]')
const wantUnmet = listOf('unmet')
const wantAbandoned = listOf('abandoned')

const CHECKER = '/Users/mc/.claude/skills/unlazy/scripts/gate-check.mjs'
const st = spawnSync(process.execPath, [CHECKER, '--status', ledger], { cwd: ROOT, encoding: 'utf8' })
const out = `${st.stdout}${st.stderr}`
const total = Number(/: (\d+) gates/.exec(out)?.[1] ?? NaN)
const prefix = path.basename(ledger, '.md')
const unmet = [...out.matchAll(new RegExp(`^\\s+UNMET ${prefix}:(\\S+)`, 'gm'))].map((m) => m[1]).sort()
// Abandoned gates are declared in the ledger itself (ABANDON: <id> <reason>).
const ledgerText = readFileSync(path.join(ROOT, ledger), 'utf8')
const abandonedInLedger = [...ledgerText.matchAll(/^ABANDON: (\S+) /gm)].map((m) => m[1]).sort()
const met = Number(/met: (\d+)/.exec(out)?.[1] ?? NaN)

assert(Number.isFinite(total) && total > 0, `could not read the gate count:\n${out.slice(0, 800)}`)
assert(JSON.stringify(unmet) === JSON.stringify(wantUnmet), `unmet gates [${unmet}] ≠ expected [${wantUnmet}]`)
assert(JSON.stringify(abandonedInLedger) === JSON.stringify(wantAbandoned), `abandoned gates [${abandonedInLedger}] ≠ expected [${wantAbandoned}]`)
assert(met === total - unmet.length - abandonedInLedger.length, `${met} met of ${total} (unmet ${unmet.length}, abandoned ${abandonedInLedger.length})`)

// Freshness: the ledger's last write follows every tracked source file's.
const tracked = execFileSync('git', ['ls-files', '--', 'src', 'scripts', 'package.json', 'next.config.ts', 'pnpm-lock.yaml'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src', 'scripts'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
let newest = { file: '', t: 0 }
for (const f of [...tracked, ...untracked]) {
  const t = statSync(path.join(ROOT, f)).mtimeMs
  if (t > newest.t) newest = { file: f, t }
}
const ledgerT = statSync(path.join(ROOT, ledger)).mtimeMs
assert(ledgerT > newest.t, `${ledger} (${new Date(ledgerT).toISOString()}) predates ${newest.file} (${new Date(newest.t).toISOString()}) — re-run it from a reset`)
console.log(`  ${ledger}: ${met}/${total} met${unmet.length ? `, unmet ${unmet}` : ''}${abandonedInLedger.length ? `, abandoned ${abandonedInLedger}` : ''}`)
console.log(`  written ${new Date(ledgerT).toISOString()}, after the newest source file ${newest.file} (${new Date(newest.t).toISOString()})`)
ok('LEDGER_FRESH_OK')
