import * as migration_20260831_003321_initial_schema from './20260831_003321_initial_schema'
import * as migration_20260831_003322_search_vector from './20260831_003322_search_vector'
import * as migration_20261105_160427_media_legacy_fields from './20261105_160427_media_legacy_fields'
import * as migration_20261119_120000_search_body from './20261119_120000_search_body'
import * as migration_20261124_092503_backoffice_review_autosave from './20261124_092503_backoffice_review_autosave'
import * as migration_20261124_095739_parity_categories_issue_article from './20261124_095739_parity_categories_issue_article'
import * as migration_20261124_102941_parity_grand_angle from './20261124_102941_parity_grand_angle'
import * as migration_20261124_114708_parity_signatures from './20261124_114708_parity_signatures'

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
  // Back office: the review flag (reviewState) and autosave on article versions.
  {
    up: migration_20261124_092503_backoffice_review_autosave.up,
    down: migration_20261124_092503_backoffice_review_autosave.down,
    name: '20261124_092503_backoffice_review_autosave',
  },
  // Parity with vh.ma: secondary categories, article-backed issues, issue view counts.
  {
    up: migration_20261124_095739_parity_categories_issue_article.up,
    down: migration_20261124_095739_parity_categories_issue_article.down,
    name: '20261124_095739_parity_categories_issue_article',
  },
  // Parity with vh.ma: the curated Grand Angle page.
  {
    up: migration_20261124_102941_parity_grand_angle.up,
    down: migration_20261124_102941_parity_grand_angle.down,
    name: '20261124_102941_parity_grand_angle',
  },
  // Parity with vh.ma: bylines (Signatures) and author archives. Its snapshot (.json) is the
  // merged schema, back office included, so the next migrate:create diffs from the truth.
  {
    up: migration_20261124_114708_parity_signatures.up,
    down: migration_20261124_114708_parity_signatures.down,
    name: '20261124_114708_parity_signatures',
  },
]
