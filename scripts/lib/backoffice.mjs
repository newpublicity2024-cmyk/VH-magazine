/**
 * Shared pieces of the back-office gates (GATES-BACKOFFICE.md).
 *
 * Every BO gate that writes stamps its rows `g7N-…` — the same `^g[0-9]{2}-` shape G44 of
 * GATES.md detects — so a row left behind is caught by two detectors (G44 and BO-G17).
 * Users are stamped in their email (`g7N-<role>-<ms>@gate.vh.ma`), articles in their slug or by
 * their stamped author.
 *
 * Cleanup order is the FK order, learned the hard way (CLAUDE.md landmine): versions before
 * articles (`_articles_v.parent_id` is ON DELETE SET NULL), and an article's lock and the user's
 * preferences before the user (`*_rels.users_id`).
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { GateFailure, ROOT, pgClient } from './harness.mjs'

export const PASSWORD = 'Gate-backoffice-2026!'

/** `g7N` stamp parts for one gate run. */
export function stampFor(gate) {
  const ms = Date.now()
  return {
    ms,
    gate,
    email: (role) => `${gate}-${role}-${ms}@gate.vh.ma`,
    slug: (name) => `${gate}-${name}-${ms}`,
    title: (name) => `${gate.toUpperCase()} ${name} ${ms}`,
    patterns: {
      email: `^${gate}-[a-z0-9]+-${ms}@gate\\.vh\\.ma$`,
      slug: `^${gate}-`,
      path: `/${gate}-`,
    },
    anyRun: {
      email: `^${gate}-[a-z0-9]+-[0-9]+@gate\\.vh\\.ma$`,
      slug: `^${gate}-`,
      path: `/${gate}-`,
    },
  }
}

/**
 * Run TypeScript against the real Payload config (and therefore `.env` → vh_backoffice) and
 * return the JSON the script prints on its LAST stdout line. The script receives `p` (the
 * Payload instance) and must `print(value)` exactly once.
 */
export function runDriver(body, { timeoutMs = 180_000 } = {}) {
  const file = path.join(ROOT, `.bo-driver-${process.pid}-${randomBytes(4).toString('hex')}.ts`)
  writeFileSync(
    file,
    `import 'dotenv/config'
import { getPayload } from 'payload'
import config from './src/payload.config'
const print = (v: unknown) => { process.stdout.write('\\n__BO__' + JSON.stringify(v) + '\\n') }
const p = await getPayload({ config })
try {
${body}
} catch (e) {
  const err = e as { name?: string; message?: string; data?: unknown; status?: number }
  print({ __error: { name: err?.name, message: err?.message, data: err?.data, status: err?.status } })
}
process.exit(0)
`,
  )
  try {
    const run = spawnSync('pnpm', ['exec', 'tsx', path.basename(file)], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: timeoutMs,
      env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
    })
    const out = `${run.stdout ?? ''}`
    const line = out
      .split('\n')
      .reverse()
      .find((l) => l.startsWith('__BO__'))
    if (run.status !== 0 || !line) {
      throw new GateFailure(
        `driver exited ${run.status ?? run.signal} without a result:\n${`${run.stdout}${run.stderr}`.slice(-3000)}`,
      )
    }
    const value = JSON.parse(line.slice('__BO__'.length))
    if (value && value.__error)
      throw new GateFailure(`driver threw: ${JSON.stringify(value.__error)}`)
    return value
  } finally {
    try {
      unlinkSync(file)
    } catch {
      /* already gone */
    }
  }
}

/** Create throwaway users; returns [{ role, email, id, name }]. */
export function createUsers(stamp, roles) {
  const specs = roles.map((role, i) => ({
    role: role.replace(/[0-9]+$/, ''),
    key: role,
    email: stamp.email(role),
    name: `${stamp.gate.toUpperCase()} ${role === 'admin' ? 'Admin' : role === 'editor' ? 'Rédac' : 'Plume'} ${i + 1}`,
  }))
  const created = runDriver(`
const specs = ${JSON.stringify(specs)}
const out = []
for (const s of specs) {
  const u = await p.create({ collection: 'users', data: { email: s.email, password: ${JSON.stringify(PASSWORD)}, name: s.name, role: s.role }, overrideAccess: true })
  out.push({ key: s.key, role: s.role, email: s.email, id: u.id, name: s.name })
}
print(out)
`)
  return Object.fromEntries(created.map((u) => [u.key, u]))
}

/**
 * Delete everything a BO gate run (or any earlier run of that gate) left: its users' articles
 * and versions, articles stamped with its slug, redirects naming its paths, the users' locks and
 * preferences, then the users. Returns rows deleted per table and rows still matching.
 */
export async function cleanupGate(patterns) {
  const c = await pgClient()
  try {
    const users = (
      await c.query('select id from users where email ~ $1', [patterns.email])
    ).rows.map((r) => r.id)
    const articles = (
      await c.query('select id from articles where slug ~ $1 or author_id = any($2::int[])', [
        patterns.slug,
        users,
      ])
    ).rows.map((r) => r.id)
    const deleted = {}
    deleted.locks = (
      await c.query(
        `delete from payload_locked_documents where id in (
           select parent_id from payload_locked_documents_rels
            where users_id = any($1::int[]) or articles_id = any($2::int[]))`,
        [users, articles],
      )
    ).rowCount
    deleted.versions = (
      await c.query(
        `delete from _articles_v where parent_id = any($1::int[]) or version_slug ~ $2 or version_author_id = any($3::int[])`,
        [articles, patterns.slug, users],
      )
    ).rowCount
    deleted.articles = (
      await c.query('delete from articles where id = any($1::int[])', [articles])
    ).rowCount
    deleted.redirects = (
      await c.query('delete from redirects where "from" ~ $1 or "to" ~ $1', [patterns.path])
    ).rowCount
    deleted.preferences = (
      await c.query(
        `delete from payload_preferences where id in (
           select parent_id from payload_preferences_rels where users_id = any($1::int[]))`,
        [users],
      )
    ).rowCount
    // A rubric or keyword only exists if an access gate failed open; remove it either way.
    deleted.categories = (
      await c.query('delete from categories where slug ~ $1', [patterns.slug])
    ).rowCount
    deleted.tags = (await c.query('delete from tags where slug ~ $1', [patterns.slug])).rowCount
    deleted.users = (await c.query('delete from users where id = any($1::int[])', [users])).rowCount
    const left = (
      await c.query(
        `select (select count(*) from users where email ~ $1)::int as users,
                (select count(*) from articles where slug ~ $2)::int as articles,
                (select count(*) from _articles_v where version_slug ~ $2)::int as versions,
                (select count(*) from redirects where "from" ~ $3 or "to" ~ $3)::int as redirects`,
        [patterns.email, patterns.slug, patterns.path],
      )
    ).rows[0]
    return { deleted, left }
  } finally {
    await c.end()
  }
}

/** Ids of a seeded category (vh-moteur, nested: 3-segment URLs) and the first media rows. */
export async function fixtureRefs(n = 3) {
  const c = await pgClient()
  try {
    const cat = (await c.query(`select id from categories where slug = 'vh-moteur' limit 1`))
      .rows[0]
    const media = (
      await c.query(
        `select id from media where mime_type like 'image/%' and width is not null order by id limit $1`,
        [n],
      )
    ).rows.map((r) => r.id)
    if (!cat || media.length < n)
      throw new GateFailure(`fixtures missing: category=${!!cat} media=${media.length}`)
    return { categoryId: cat.id, mediaIds: media }
  } finally {
    await c.end()
  }
}

/** A Lexical body with one paragraph of text — enough to count as « written ». */
export const simpleBody = (text) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        textFormat: 0,
        children: [
          { type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
        ],
      },
    ],
  },
})

/** Log in through Payload's REST endpoint; returns the Cookie header value. */
export async function apiLogin(baseUrl, email, password = PASSWORD) {
  const res = await fetch(`${baseUrl}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new GateFailure(`login ${email} answered ${res.status}`)
  const cookies = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')]
  const token = cookies.map((c) => String(c).split(';')[0]).find((c) => c.startsWith('vh-token='))
  if (!token) throw new GateFailure(`login ${email}: no vh-token cookie`)
  return token
}

/** Log a Playwright page in through the admin form (correct password only — Payload locks after 5 failures). */
export async function browserLogin(page, baseUrl, email, password = PASSWORD) {
  await page.goto(`${baseUrl}/admin/login/`, { waitUntil: 'load' })
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60_000 }),
    page.click('button[type="submit"]'),
  ])
}
