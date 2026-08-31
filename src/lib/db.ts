import { Pool } from 'pg'

/**
 * A small dedicated Postgres pool for the two places that genuinely need raw
 * SQL: the view counter's atomic increment and full-text search.
 *
 * Deliberately NOT `payload.db.pool`. That is adapter internals — undocumented,
 * unversioned, and it changes shape between Payload releases; reaching into it
 * would make an upgrade break the site silently. A separate small pool is a few
 * connections in exchange for a stable contract.
 *
 * Module-level so it is created once per runtime and reused across requests,
 * never per-request.
 */

declare global {
  // eslint-disable-next-line no-var
  var __vhPool: Pool | undefined
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  return new Pool({
    connectionString,
    // Small: this pool only serves the counter and search. Payload's own pool
    // handles everything else, and two large pools would exhaust Postgres's
    // connection limit on a serverless host.
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
}

/**
 * In dev, Next's hot reload re-evaluates modules on every change. Without the
 * global cache each reload would leak a pool and the database would refuse
 * connections after a dozen edits.
 */
export function getPool(): Pool {
  if (process.env.NODE_ENV === 'production') {
    if (!global.__vhPool) global.__vhPool = createPool()
    return global.__vhPool
  }
  if (!global.__vhPool) global.__vhPool = createPool()
  return global.__vhPool
}

/** Parameterised query helper. Never interpolate user input into `text`. */
export async function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, params as never[])
  return result.rows as T[]
}
