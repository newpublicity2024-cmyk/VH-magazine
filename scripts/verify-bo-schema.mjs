/**
 * BO-G3 — the back-office migration is applied and the schema matches the config.
 *
 * Measured in the database the app uses (.env → vh_backoffice):
 *  - `articles.review_state` and `_articles_v.version_review_state` exist as enums with exactly
 *    the values the config declares ('none', 'pending'), default 'none', and no row is NULL;
 *  - `_articles_v.autosave` exists (Payload's autosave writes it);
 *  - the migration is recorded in payload_migrations;
 *  - `payload migrate:create --skip-empty` generates NOTHING: the config and the migration
 *    snapshots agree, so no schema change is hiding in the config un-migrated. Payload computes
 *    the diff, then with --skip-empty exits 0 silently when it is empty and writes a migration
 *    file when it is not (@payloadcms/drizzle buildCreateMigration). So the run must log that it
 *    computed the DOWN statements (proof the diff ran), create no file, and leave index.ts
 *    byte-identical; anything it writes is removed again and fails the gate.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { ROOT, assert, assertEqual, fail, ok, pgClient } from './lib/harness.mjs'

const MIGRATION = '20261124_092503_backoffice_review_autosave'

const c = await pgClient()
let facts
try {
  const enums = async (type) =>
    (
      await c.query(
        `select e.enumlabel from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typname = $1 order by e.enumsortorder`,
        [type],
      )
    ).rows.map((r) => r.enumlabel)
  const column = async (table, col) =>
    (
      await c.query(
        `select data_type, udt_name, column_default from information_schema.columns where table_name = $1 and column_name = $2`,
        [table, col],
      )
    ).rows[0]
  facts = {
    articleEnum: await enums('enum_articles_review_state'),
    versionEnum: await enums('enum__articles_v_version_review_state'),
    articleCol: await column('articles', 'review_state'),
    versionCol: await column('_articles_v', 'version_review_state'),
    autosaveCol: await column('_articles_v', 'autosave'),
    nullArticles: Number(
      (await c.query('select count(*) from articles where review_state is null')).rows[0].count,
    ),
    nullVersions: Number(
      (await c.query('select count(*) from _articles_v where version_review_state is null')).rows[0]
        .count,
    ),
    migrated: Number(
      (await c.query('select count(*) from payload_migrations where name = $1', [MIGRATION]))
        .rows[0].count,
    ),
  }
} finally {
  await c.end()
}

assertEqual(
  JSON.stringify(facts.articleEnum),
  JSON.stringify(['none', 'pending']),
  'articles review_state enum values',
)
assertEqual(
  JSON.stringify(facts.versionEnum),
  JSON.stringify(['none', 'pending']),
  '_articles_v version_review_state enum values',
)
assert(
  facts.articleCol?.udt_name === 'enum_articles_review_state',
  `articles.review_state column: ${JSON.stringify(facts.articleCol)}`,
)
assert(
  /'none'/.test(facts.articleCol?.column_default ?? ''),
  `articles.review_state default: ${facts.articleCol?.column_default}`,
)
assert(
  facts.versionCol?.udt_name === 'enum__articles_v_version_review_state',
  `_articles_v.version_review_state column: ${JSON.stringify(facts.versionCol)}`,
)
assert(
  facts.autosaveCol?.data_type === 'boolean',
  `_articles_v.autosave column: ${JSON.stringify(facts.autosaveCol)}`,
)
assertEqual(facts.nullArticles, 0, 'articles with a NULL review_state')
assertEqual(facts.nullVersions, 0, 'article versions with a NULL review state')
assertEqual(facts.migrated, 1, `payload_migrations rows for ${MIGRATION}`)

// Drift: generate against the config and require that nothing is generated.
const dir = path.join(ROOT, 'src', 'migrations')
const before = new Set(readdirSync(dir))
const indexFile = path.join(dir, 'index.ts')
const indexBefore = readFileSync(indexFile, 'utf8')
const run = spawnSync(
  'pnpm',
  ['exec', 'payload', 'migrate:create', 'bo_drift_probe', '--skip-empty'],
  {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 5 * 60 * 1000,
    env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
  },
)
const created = readdirSync(dir).filter((f) => !before.has(f))
for (const f of created) unlinkSync(path.join(dir, f))
const indexChanged = readFileSync(indexFile, 'utf8') !== indexBefore
if (indexChanged) writeFileSync(indexFile, indexBefore)
const output = `${run.stdout}${run.stderr}`
if (created.length)
  fail(
    `migrate:create generated ${created.join(', ')} — the config holds schema changes no migration carries (removed again)`,
  )
assert(run.status === 0, `migrate:create exited ${run.status}:\n${output.slice(-1500)}`)
assert(!indexChanged, 'migrate:create rewrote src/migrations/index.ts (restored)')
assert(
  /DOWN statements generation complete/.test(output),
  `migrate:create never computed the schema diff:\n${output.slice(-1500)}`,
)

console.error(
  `  review_state enums + autosave column present, 0 NULL rows, ${MIGRATION} recorded, no schema drift`,
)
ok('BO_SCHEMA_OK')
