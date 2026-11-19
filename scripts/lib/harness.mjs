/**
 * Shared harness for the gate verifiers.
 *
 * Design rules, because these scripts are the only thing standing between a
 * confident "done" and an actually-working site:
 *
 *  - A verifier prints its success token ONLY after every assertion has passed.
 *    There is no code path that reaches the token having skipped a check.
 *  - `withServer` spawns and kills its OWN server, so an HTML gate can never
 *    pass against a stale process someone left running on port 3000.
 *  - Assertions report expected vs measured, not just "failed".
 */
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export const ROOT = path.resolve(import.meta.dirname, '..', '..')
// No fixed port: each withServer() call takes a fresh OS-assigned one, so two
// gates can never contend for the same port or inherit a leaked server.

/** Parse .env without a dependency. Values are not expanded — none need it. */
export function loadEnv() {
  const file = path.join(ROOT, '.env')
  if (!existsSync(file)) fail(`.env not found at ${file}`)
  const env = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

export function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

export function assert(condition, message) {
  if (!condition) fail(message)
}

export function assertEqual(actual, expected, what) {
  if (actual !== expected) {
    fail(`${what} — expected ${JSON.stringify(expected)}, measured ${JSON.stringify(actual)}`)
  }
}

/**
 * Print the success token and exit.
 *
 * The explicit exit is load-bearing. A verifier that has printed its token has
 * finished, but a detached child or a browser handle can keep Node's event loop
 * alive indefinitely — the checker then SIGKILLs the process and records a
 * FAILURE for a gate whose every assertion passed. Flush first: process.exit()
 * can truncate a pending stdout write, which would swallow the token itself.
 */
export function ok(token) {
  process.stdout.write(`${token}\n`, () => process.exit(0))
}

/**
 * Thrown by check() / checkEqual(). assert() exits on the spot, which skips every
 * `finally` — so a gate that had written to the database left its rows behind whenever
 * an assertion failed (G35's stray article sat in "Derniers articles"). A GateFailure
 * unwinds instead: through withServer, which kills its server on the way, and into
 * withCleanup, which cleans up before reporting.
 */
export class GateFailure extends Error {}

export function check(condition, message) {
  if (!condition) throw new GateFailure(message)
}

export function checkEqual(actual, expected, what) {
  if (actual !== expected) {
    throw new GateFailure(
      `${what} — expected ${JSON.stringify(expected)}, measured ${JSON.stringify(actual)}`,
    )
  }
}

/**
 * G43's switch: GATE_INJECT_FAILURE=<stage> makes a database-writing gate fail at that
 * stage, so G43 can prove the cleanup runs on the failure path too.
 */
export function injectedFailure(stage) {
  if (process.env.GATE_INJECT_FAILURE === stage) {
    throw new GateFailure(`injected failure at "${stage}" (GATE_INJECT_FAILURE)`)
  }
}

/**
 * Run `body`, then ALWAYS `cleanup` — after success, a failed check, or any thrown error —
 * and only then report a failure. Inside `body`, use check()/checkEqual(), never assert().
 *
 * Not covered: a fail() deeper down (withServer's readiness probe) still exits at once.
 * Every writer therefore also sweeps its own stale rows when it starts, and G44 measures
 * the database for anything left in between.
 */
export async function withCleanup(body, cleanup) {
  let error = null
  try {
    await body()
  } catch (e) {
    error = e
  }
  let cleanupError = null
  try {
    await cleanup()
  } catch (e) {
    cleanupError = e
  }
  const text = (e) => (e instanceof GateFailure ? e.message : (e?.stack ?? String(e)))
  if (error) fail(text(error))
  if (cleanupError) fail(`cleanup failed: ${text(cleanupError)}`)
}

/**
 * Delete a writer gate's throwaway articles, their versions and their redirects.
 *
 * Versions go FIRST. `_articles_v.parent_id` is ON DELETE SET NULL: deleting the article
 * first strands its versions with a null parent, where `delete … where parent_id = $1`
 * no longer finds them — 97 had piled up in vh_magazine by 2026-11-17.
 *
 * `slug` and `path` are anchored POSIX regexes (`~`) naming the gate's own stamped slugs
 * and redirect paths, so no real article can match. Returns the rows deleted per table
 * and the rows still matching afterwards.
 */
export async function deleteGateRows(client, { slug, path }) {
  const deleted = {}
  deleted.versions = (
    await client.query(
      `delete from _articles_v
        where version_slug ~ $1 or parent_id in (select id from articles where slug ~ $1)`,
      [slug],
    )
  ).rowCount
  deleted.articles = (await client.query('delete from articles where slug ~ $1', [slug])).rowCount
  deleted.redirects = (
    await client.query('delete from redirects where "from" ~ $1 or "to" ~ $1', [path])
  ).rowCount
  const { rows } = await client.query(
    `select (select count(*) from articles where slug ~ $1)::int as articles,
            (select count(*) from _articles_v where version_slug ~ $1)::int as versions,
            (select count(*) from redirects where "from" ~ $2 or "to" ~ $2)::int as redirects`,
    [slug, path],
  )
  return { deleted, left: rows[0] }
}

/** A pg client bound to DATABASE_URL from .env. Caller must `await client.end()`. */
export async function pgClient() {
  const { default: pg } = await import('pg')
  const env = loadEnv()
  if (!env.DATABASE_URL) fail('DATABASE_URL is not set in .env')
  const client = new pg.Client({ connectionString: env.DATABASE_URL })
  await client.connect()
  return client
}

/** Ask the OS for a free port by binding to :0 and releasing it. */
async function freePort() {
  const net = await import('node:net')
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

/** True when something is already listening on `port`. */
async function portInUse(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(1500),
    })
    return res.status > 0
  } catch {
    return false
  }
}

async function waitForReady(url, child, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      fail(
        `server exited with code ${child.exitCode} before becoming ready. ` +
          'If the port was already bound, an earlier gate leaked its server.',
      )
    }
    try {
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(3000) })
      if (res.status > 0) {
        // Re-check liveness: a response can arrive from a STALE server that owns
        // the port while our own child is busy dying. Only a response plus a
        // living child proves we are talking to the server we started.
        await new Promise((r) => setTimeout(r, 250))
        if (child.exitCode !== null) {
          fail(
            `a server answered on ${url} but our child exited (code ${child.exitCode}) — ` +
              'the port is held by a stale process from an earlier gate.',
          )
        }
        return
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  fail(`server did not become ready on ${url} within ${timeoutMs}ms`)
}

/**
 * Spawn `next start` on a FRESH port, run `fn(baseUrl)`, then always kill it.
 *
 * A fixed port was a real bug: `pnpm exec next start` forks, so killing the
 * process group sometimes missed the grandchild, leaving a server bound to the
 * port. The next gate's own server then failed to bind and exited, while
 * waitForReady happily got a 200 from the LEAKED server — which was serving a
 * pre-rebuild bundle. Two gates "failed" against stale CSS and two others could
 * just as easily have passed against it.
 *
 * So: a fresh OS-assigned port per invocation (no collision possible), an
 * explicit refusal to run if it is somehow already bound, and teardown that
 * kills the group AND anything still listening, then waits for the port to
 * actually free.
 */
export async function withServer(fn) {
  if (!existsSync(path.join(ROOT, '.next'))) {
    fail('no .next build found — run `pnpm build` (gate G6) before the HTML gates')
  }

  const port = await freePort()
  if (await portInUse(port)) {
    fail(`port ${port} was already bound before spawning — refusing to test against it`)
  }

  const child = spawn('pnpm', ['exec', 'next', 'start', '-p', String(port)], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
  })

  // Detached keeps the child in its own process group (so we can kill the whole
  // tree), but it also keeps a handle on OUR event loop. unref() drops that
  // handle so this process can exit once its work is done.
  child.unref()

  let serverLog = ''
  child.stdout.on('data', (d) => (serverLog += d))
  child.stderr.on('data', (d) => (serverLog += d))

  const baseUrl = `http://127.0.0.1:${port}`

  const kill = async () => {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      /* group already gone */
    }
    try {
      process.kill(child.pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
    // Belt and braces: next forks, and the fork can outlive its process group.
    //
    // `-sTCP:LISTEN` and the self-PID filter are both essential. A bare
    // `lsof -ti :PORT` lists every process holding that port open — INCLUDING
    // the client side, which is this very process (it just fetched the page).
    // Piping that into `kill -9` makes the verifier kill itself: every gate
    // died with exit 137 after all its assertions had passed, and the checker
    // faithfully reported the resulting SIGKILL as a gate failure.
    try {
      const { execSync } = await import('node:child_process')
      const listeners = execSync(`lsof -ti :${port} -sTCP:LISTEN 2>/dev/null || true`, {
        encoding: 'utf8',
        shell: '/bin/sh',
      })
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^\d+$/.test(l))
        .map(Number)
        .filter((pid) => pid !== process.pid && pid !== process.ppid)

      for (const pid of listeners) {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          /* already gone */
        }
      }
    } catch {
      /* nothing listening */
    }
    try {
      child.stdout?.destroy()
      child.stderr?.destroy()
    } catch {
      /* already closed */
    }
    for (let i = 0; i < 20; i += 1) {
      if (!(await portInUse(port))) return
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  // fail() and ok() end the process with process.exit, which skips the finally below.
  // Without this, every failing gate left its `next start` running (seven had piled up by
  // 2026-11-11, each holding memory and database connections). 'exit' listeners run
  // synchronously, and process.kill is synchronous, so the group dies with us.
  const killOnExit = () => {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      /* group already gone */
    }
  }
  process.on('exit', killOnExit)

  try {
    await waitForReady(baseUrl, child)
    return await fn(baseUrl)
  } catch (error) {
    if (serverLog.trim()) {
      console.error('--- server output ---')
      console.error(serverLog.slice(-4000))
      console.error('---------------------')
    }
    throw error
  } finally {
    process.off('exit', killOnExit)
    await kill()
  }
}

/** Fetch a URL and return { status, html, headers }. */
export async function getHtml(url) {
  const res = await fetch(url, { redirect: 'follow' })
  const html = await res.text()
  return { status: res.status, html, headers: res.headers }
}

/**
 * Strip <script> blocks before any counting or parsing.
 *
 * Next embeds the RSC flight payload in inline scripts as
 * `self.__next_f.push(...)`, and that payload is a serialised copy of the whole
 * tree — every data-card, every href, every date appears a second time inside
 * it. Counting over the raw response therefore double-counts everything (42
 * cards measured as 84). The rendered DOM is what the gates are about, so the
 * scripts come out first.
 */
export function stripScripts(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '')
}

/**
 * Fetch the homepage HTML once, for the gates that all read it.
 * Returns the DOM only — see stripScripts.
 */
export async function homepageHtml() {
  return withServer(async (baseUrl) => {
    const { status, html } = await getHtml(`${baseUrl}/`)
    assertEqual(status, 200, 'homepage status')
    assert(html.length > 1000, `homepage HTML suspiciously short (${html.length} bytes)`)
    const dom = stripScripts(html)
    assert(
      dom.length > 1000,
      `homepage DOM suspiciously short after stripping scripts (${dom.length} bytes)`,
    )
    return dom
  })
}

/**
 * Extract the inner HTML of the element carrying data-section="<key>".
 *
 * Deliberately a depth-counting scanner rather than a regex: sections nest cards
 * and other elements, and a lazy regex would stop at the first closing tag and
 * silently under-count everything inside — which would make the card-count gate
 * pass for the wrong reason.
 */
export function sectionHtml(html, key) {
  return elementHtml(html, 'data-section', key)
}

/** Same, for sidebar widgets, which live in their own `data-widget` namespace so
 *  G8's strict data-section allowlist stays meaningful. */
export function widgetHtml(html, key) {
  return elementHtml(html, 'data-widget', key)
}

export function elementHtml(html, attr, key) {
  const marker = `${attr}="${key}"`
  const at = html.indexOf(marker)
  if (at === -1) return null

  const tagStart = html.lastIndexOf('<', at)
  const tagNameMatch = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(tagStart))
  if (!tagNameMatch) return null
  const tag = tagNameMatch[1]

  const openRe = new RegExp(`<${tag}(\\s|>)`, 'g')
  const closeRe = new RegExp(`</${tag}>`, 'g')
  const bodyStart = html.indexOf('>', at) + 1

  let depth = 1
  let cursor = bodyStart
  while (depth > 0 && cursor < html.length) {
    openRe.lastIndex = cursor
    closeRe.lastIndex = cursor
    const nextOpen = openRe.exec(html)
    const nextClose = closeRe.exec(html)
    if (!nextClose) return html.slice(bodyStart)
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1
      cursor = nextOpen.index + 1
    } else {
      depth -= 1
      cursor = nextClose.index + 1
      if (depth === 0) return html.slice(bodyStart, nextClose.index)
    }
  }
  return html.slice(bodyStart)
}

/** All values of an attribute across the document, e.g. attrValues(html, 'href'). */
export function attrValues(html, attr) {
  const re = new RegExp(`${attr}="([^"]*)"`, 'g')
  const out = []
  let m
  while ((m = re.exec(html)) !== null) out.push(m[1])
  return out
}

/** Count occurrences of a marker string. */
export function countMarkers(html, marker) {
  if (!html) return 0
  return html.split(marker).length - 1
}
