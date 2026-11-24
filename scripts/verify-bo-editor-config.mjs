/**
 * BO-G6 — the article editor offers exactly the journalist toolset.
 *
 * Imports `articleFeatures()` from src/lib/editor-config.ts (no Payload boot needed — that is
 * why the list lives in its own module) and reads each feature's key, the heading sizes and the
 * block slugs. The expectation is the set the back office promises; an extra feature or a
 * missing one fails, so the toolbar cannot drift from what RichTextBody renders (BO-G7).
 */
import { spawnSync } from 'node:child_process'

import { ROOT, assert, assertEqual, fail, ok } from './lib/harness.mjs'

const EXPECTED_KEYS = [
  'paragraph',
  'heading',
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'align',
  'link',
  'unorderedList',
  'orderedList',
  'blockquote',
  'horizontalRule',
  'experimental_table',
  'upload',
  'blocks',
  'vhLinkPaste',
  'toolbarFixed',
  'toolbarInline',
]

const probe = `
import { articleFeatures } from './src/lib/editor-config'
const fs = articleFeatures() as Array<{ key: string; serverFeatureProps?: Record<string, unknown>; dependencies?: string[] }>
const heading = fs.find((f) => f.key === 'heading')?.serverFeatureProps as { enabledHeadingSizes?: string[] } | undefined
const blocks = (fs.find((f) => f.key === 'blocks')?.serverFeatureProps as { blocks?: Array<{ slug: string }> } | undefined)?.blocks ?? []
const paste = fs.find((f) => f.key === 'vhLinkPaste')
console.log('__R__' + JSON.stringify({ keys: fs.map((f) => f.key), headings: heading?.enabledHeadingSizes ?? null, blocks: blocks.map((b) => b.slug), pasteDeps: paste?.dependencies ?? null }))
`
const run = spawnSync('pnpm', ['exec', 'tsx', '--eval', probe], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 120_000,
})
const line = `${run.stdout}`.split('\n').find((l) => l.startsWith('__R__'))
if (run.status !== 0 || !line)
  fail(`could not import articleFeatures():\n${`${run.stdout}${run.stderr}`.slice(-2000)}`)
const r = JSON.parse(line.slice(5))

const missing = EXPECTED_KEYS.filter((k) => !r.keys.includes(k))
const extra = r.keys.filter((k) => !EXPECTED_KEYS.includes(k))
assert(
  missing.length === 0,
  `features missing from the editor: ${missing.join(', ')} (have: ${r.keys.join(', ')})`,
)
assert(
  extra.length === 0,
  `features in the editor that the back office does not promise: ${extra.join(', ')}`,
)
assertEqual(
  JSON.stringify(r.headings),
  JSON.stringify(['h2', 'h3', 'h4']),
  'enabled heading sizes (h1 must never be offered)',
)
assertEqual(
  JSON.stringify([...r.blocks].sort()),
  JSON.stringify(['gallery', 'videoEmbed']),
  'body blocks',
)
assert(
  Array.isArray(r.pasteDeps) && r.pasteDeps.includes('blocks'),
  `link paste must depend on the blocks feature: ${JSON.stringify(r.pasteDeps)}`,
)

console.error(
  `  ${r.keys.length} features: ${r.keys.join(', ')}; headings ${r.headings.join('/')}; blocks ${r.blocks.join(', ')}`,
)
ok('BO_EDITOR_CONFIG_OK')
