import * as migration_20260831_003321_initial_schema from './20260831_003321_initial_schema';
import * as migration_20260831_003322_search_vector from './20260831_003322_search_vector';
import * as migration_20261105_160427_media_legacy_fields from './20261105_160427_media_legacy_fields';
import * as migration_20261119_120000_search_body from './20261119_120000_search_body';
import * as migration_20261124_095739_parity_categories_issue_article from './20261124_095739_parity_categories_issue_article';

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
  {
    up: migration_20261105_160427_media_legacy_fields.up,
    down: migration_20261105_160427_media_legacy_fields.down,
    name: '20261105_160427_media_legacy_fields',
  },
  {
    up: migration_20261119_120000_search_body.up,
    down: migration_20261119_120000_search_body.down,
    name: '20261119_120000_search_body',
  },
  {
    up: migration_20261124_095739_parity_categories_issue_article.up,
    down: migration_20261124_095739_parity_categories_issue_article.down,
    name: '20261124_095739_parity_categories_issue_article'
  },
];
