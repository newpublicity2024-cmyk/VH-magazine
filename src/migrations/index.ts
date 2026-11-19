import * as migration_20260831_003321_initial_schema from './20260831_003321_initial_schema'
import * as migration_20260831_003322_search_vector from './20260831_003322_search_vector'
import * as migration_20261105_160427_media_legacy_fields from './20261105_160427_media_legacy_fields'

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
  // Round 2b: WordPress media import keys (Media.legacyPath / legacyWpId).
  {
    up: migration_20261105_160427_media_legacy_fields.up,
    down: migration_20261105_160427_media_legacy_fields.down,
    name: '20261105_160427_media_legacy_fields',
  },
]
