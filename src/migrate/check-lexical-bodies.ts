import { readFileSync } from 'fs'
import { createHeadlessEditor } from '@payloadcms/richtext-lexical/lexical/headless'
import { editorConfigFactory, getEnabledNodes } from '@payloadcms/richtext-lexical'
import type { RichTextField } from 'payload'

import config from '../payload.config'
import { query } from '../lib/db'

/**
 * Round 2b — prove that migrated article bodies open in the admin editor.
 *
 *   pnpm -s exec tsx src/migrate/check-lexical-bodies.ts <converted.jsonl>
 *   DATABASE_URL=postgres://localhost/vh_migration pnpm -s exec tsx src/migrate/check-lexical-bodies.ts --db
 *
 * The first form checks the conversion output; --db checks every article body as stored.
 *
 * Builds a headless Lexical editor from the SAME sanitised editor config the admin uses
 * for Articles.body (editorConfigFactory.fromField on the live collection config) and
 * parses every record's `body` into it. Lexical throws on a node type the config does not
 * register, a malformed node, or a child where its parent cannot hold one — exactly the
 * failures that would leave an editor staring at a crashed field. A planted unknown node
 * must be rejected first, so a silent pass cannot come from a parser that accepts anything.
 *
 * Prints 'lexical bodies verified' only when every body parses.
 */
async function main() {
  const file = process.argv[2]
  if (!file) throw new Error('usage: check-lexical-bodies.ts <converted.jsonl> | --db')

  const sanitized = await config
  const articles = sanitized.collections.find((c) => c.slug === 'articles')
  const body = articles?.fields.find((f) => 'name' in f && f.name === 'body') as
    RichTextField | undefined
  if (!body?.editor)
    throw new Error('Articles.body richText field not found in the sanitised config')
  const editorConfig = editorConfigFactory.fromField({ field: body })
  const nodes = getEnabledNodes({ editorConfig })

  const load = (root: unknown) => {
    const editor = createHeadlessEditor({
      nodes,
      onError: (e: Error) => {
        throw e
      },
    })
    editor.setEditorState(editor.parseEditorState(JSON.stringify({ root })))
    return editor.getEditorState().read(() => editor.getEditorState()._nodeMap.size)
  }

  // Negative control: a node type the editor does not register must not load.
  let controlRejected = false
  try {
    load({
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: [{ type: 'no-such-node', version: 1, children: [] }],
    })
  } catch {
    controlRejected = true
  }
  if (!controlRejected) throw new Error('negative control: an unknown node type loaded')

  const records: { label: string; root: unknown }[] =
    file === '--db'
      ? (
          await query<{ id: number; body: { root?: unknown } | null }>(
            'select id, body from articles order by id',
          )
        ).map((r) => ({ label: `article ${r.id}`, root: r.body?.root }))
      : readFileSync(file, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const rec = JSON.parse(line) as { wpId: number; body: unknown }
            return { label: `wp ${rec.wpId}`, root: rec.body }
          })
  if (!records.length) throw new Error('no bodies to check')
  const failures: string[] = []
  let nodeCount = 0
  let empty = 0
  for (const rec of records) {
    // A post with no content on WordPress is stored without a body (the field is optional);
    // an empty root is not a document Lexical accepts, so it is never written.
    if (!(rec.root as { children?: unknown[] } | undefined)?.children?.length) {
      empty++
      continue
    }
    try {
      nodeCount += load(rec.root)
    } catch (e) {
      failures.push(`${rec.label}: ${(e as Error).message.split('\n')[0]}`)
    }
  }
  if (failures.length) {
    console.error(
      `lexical bodies FAILED: ${failures.length} of ${records.length}\n  ${failures.slice(0, 20).join('\n  ')}`,
    )
    process.exit(1)
  }
  console.log(
    `${records.length - empty} bodies parsed into the Articles.body editor (${nodeCount} nodes); ${empty} without content`,
  )
  console.log('lexical bodies verified')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
