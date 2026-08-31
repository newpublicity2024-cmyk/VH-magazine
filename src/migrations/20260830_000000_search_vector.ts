import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Full-text search support for articles (spec §7).
 *
 * `search_vector` is a STORED generated column, not a trigger: Postgres keeps it
 * correct on every insert and update with no application code to forget, so a
 * row written by the seed, the admin or the 2b migration is indexed identically.
 *
 * Title is weighted 'A' and excerpt 'B' so a term in the headline outranks the
 * same term in the standfirst.
 *
 * `unaccent` must be IMMUTABLE to be used in a generated column. The stock
 * function is not (it depends on a mutable dictionary), so we wrap it in an
 * immutable SQL function — the standard workaround. It is safe here because the
 * dictionary is never modified.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(`create extension if not exists unaccent;`)

  await db.execute(`
    create or replace function vh_immutable_unaccent(text)
    returns text
    language sql
    immutable
    parallel safe
    strict
    as $$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;
  `)

  await db.execute(`
    alter table articles
      add column if not exists search_vector tsvector
      generated always as (
        setweight(to_tsvector('french', vh_immutable_unaccent(coalesce(title, ''))), 'A') ||
        setweight(to_tsvector('french', vh_immutable_unaccent(coalesce(excerpt, ''))), 'B')
      ) stored;
  `)

  await db.execute(`
    create index if not exists articles_search_vector_idx
      on articles using gin (search_vector);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(`drop index if exists articles_search_vector_idx;`)
  await db.execute(`alter table articles drop column if exists search_vector;`)
  await db.execute(`drop function if exists vh_immutable_unaccent(text);`)
}
