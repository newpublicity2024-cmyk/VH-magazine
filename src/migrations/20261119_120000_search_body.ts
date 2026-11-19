import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Search reads article bodies too (owner decision relayed 2026-11-19: "defaults + body search").
 *
 * The migrated archive keeps a hand-written excerpt on only ~1% of its articles (WordPress's
 * automatic excerpt is the body's opening, which the article page would print twice), so a
 * title + excerpt index matched titles alone for almost everything.
 *
 * Same design as 20260831_003322_search_vector: a STORED generated column, so the seed, the
 * admin and the migration importer are indexed identically with no hook to forget and no
 * backfill to run — Postgres computes the new column for every existing row when it is added.
 *
 * `vh_lexical_text` joins the `text` of every Lexical text node (paragraphs, headings, list
 * items, quotes, link labels), at any depth. It is declared IMMUTABLE so a generated column
 * may call it; that is true of what it does — jsonb_path_query (not the _tz variant),
 * jsonb_typeof and string_agg depend on nothing but their input. Text nodes are joined with a
 * space, so a word split by inline formatting ("il f**aut**") indexes as two tokens; rare, and
 * the alternative is a recursive walk per row.
 *
 * Weights: title A, excerpt B, body C — a term in the headline still outranks the same term
 * deep in the copy. Measured on the archive (8,025 bodies, 2.43 M words): the largest tsvector
 * is 38 KB (the limit is 1 MB) and computing all of them takes about a second.
 *
 * A generated column's expression cannot be altered in place, so the column and its index are
 * dropped and added again.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(`
    create or replace function vh_lexical_text(doc jsonb)
    returns text
    language sql
    immutable
    parallel safe
    as $$
      select coalesce(string_agg(t #>> '{}', ' '), '')
        from jsonb_path_query(doc, 'strict $.** ? (@.type == "text").text') as t
       where jsonb_typeof(t) = 'string'
    $$;
  `)

  await db.execute(`drop index if exists articles_search_vector_idx;`)
  await db.execute(`alter table articles drop column if exists search_vector;`)
  await db.execute(`
    alter table articles
      add column search_vector tsvector
      generated always as (
        setweight(to_tsvector('french', vh_immutable_unaccent(coalesce(title, ''))), 'A') ||
        setweight(to_tsvector('french', vh_immutable_unaccent(coalesce(excerpt, ''))), 'B') ||
        setweight(to_tsvector('french', vh_immutable_unaccent(vh_lexical_text(body))), 'C')
      ) stored;
  `)
  await db.execute(`
    create index articles_search_vector_idx
      on articles using gin (search_vector);
  `)
}

/** Restores the title + excerpt column of 20260831_003322_search_vector. */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(`drop index if exists articles_search_vector_idx;`)
  await db.execute(`alter table articles drop column if exists search_vector;`)
  await db.execute(`
    alter table articles
      add column search_vector tsvector
      generated always as (
        setweight(to_tsvector('french', vh_immutable_unaccent(coalesce(title, ''))), 'A') ||
        setweight(to_tsvector('french', vh_immutable_unaccent(coalesce(excerpt, ''))), 'B')
      ) stored;
  `)
  await db.execute(`
    create index articles_search_vector_idx
      on articles using gin (search_vector);
  `)
  await db.execute(`drop function if exists vh_lexical_text(jsonb);`)
}
