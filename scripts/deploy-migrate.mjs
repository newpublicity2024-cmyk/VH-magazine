/**
 * Run Payload migrations as a build step, with one deliberate distinction:
 *
 *   - env vars ABSENT     -> skip, warn, exit 0.
 *     This is the "not wired up yet" case. The build should still succeed so a
 *     preview deploys and you can see the shell; the pages degrade via
 *     lib/build-safe.ts.
 *
 *   - env vars PRESENT but the migration FAILS -> exit 1.
 *     That is a real error. Deploying against a half-migrated database would
 *     serve traffic from a schema nobody has verified, which is worse than a
 *     failed build.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

/*
 * On Vercel these come from the platform environment. Locally they live in
 * .env, which a plain node process does not read — without this the script
 * would report "not set" on a machine where the database is right there, and
 * silently skip migrations during a local build.
 */
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    if (!process.env[key]) process.env[key] = t.slice(eq + 1).trim()
  }
}

const hasDb = Boolean(process.env.DATABASE_URL)
const hasSecret = Boolean(process.env.PAYLOAD_SECRET)

if (!hasDb || !hasSecret) {
  const missing = [!hasDb && 'DATABASE_URL', !hasSecret && 'PAYLOAD_SECRET'].filter(Boolean)
  console.warn(
    `\n[deploy-migrate] Skipping migrations: ${missing.join(' and ')} not set.\n` +
      `[deploy-migrate] The build will continue and pages will render an empty shell.\n` +
      `[deploy-migrate] Set these in your Vercel project settings to get a working site.\n`,
  )
  process.exit(0)
}

console.log('[deploy-migrate] running payload migrate…')
const result = spawnSync(
  'pnpm',
  ['exec', 'payload', 'migrate'],
  { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--no-deprecation' } },
)

if (result.status !== 0) {
  console.error(
    '\n[deploy-migrate] Migrations FAILED while DATABASE_URL was set.\n' +
      '[deploy-migrate] Refusing to build against an unverified schema.\n',
  )
  process.exit(1)
}
console.log('[deploy-migrate] migrations applied.')
