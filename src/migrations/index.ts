import * as migration_20260831_003321_initial_schema from './20260831_003321_initial_schema'
import * as migration_20260831_003322_search_vector from './20260831_003322_search_vector'

/**
 * Order matters and is NOT derived from the filenames — Payload runs this array
 * top to bottom. The search migration adds a generated column and a GIN index to
 * `articles`, so it must come after the schema that creates that table, or a
 * fresh database fails on the first deploy.
 */
export const migrations = [
  {
    up: migration_20260831_003321_initial_schema.up,
    down: migration_20260831_003321_initial_schema.down,
    name: '20260831_003321_initial_schema',
  },
  {
    up: migration_20260831_003322_search_vector.up,
    down: migration_20260831_003322_search_vector.down,
    name: '20260831_003322_search_vector',
  },
]
