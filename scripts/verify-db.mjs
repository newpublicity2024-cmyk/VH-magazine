/**
 * G1 — local Postgres is running and the vh_magazine database is reachable.
 *
 * Asserts a real round-trip, not just a successful TCP connect: a connection to
 * the wrong database or a server that is up but not accepting queries would
 * otherwise read as success.
 */
import { pgClient, assert, assertEqual, ok, loadEnv, fail } from './lib/harness.mjs'

const env = loadEnv()
const expectedDb = new URL(env.DATABASE_URL.replace(/^postgres(ql)?:/, 'http:')).pathname.slice(1)

let client
try {
  client = await pgClient()
} catch (error) {
  fail(`could not connect with DATABASE_URL from .env — ${error.message}`)
}

const { rows } = await client.query(
  'select current_database() as db, version() as version, 1 + 1 as arithmetic',
)

assertEqual(rows[0].arithmetic, 2, 'round-trip query result')
assertEqual(rows[0].db, expectedDb, 'connected database name')
assert(
  /PostgreSQL (1[7-9]|[2-9]\d)\./.test(rows[0].version),
  `server version — expected PostgreSQL 17 or newer, measured ${rows[0].version.split(',')[0]}`,
)

// Payload needs to create its own schema objects; a read-only role would fail
// far later and much more confusingly, during the first push.
await client.query('create table if not exists _vh_conn_check (id int)')
await client.query('drop table _vh_conn_check')

await client.end()
ok('DB_OK')
