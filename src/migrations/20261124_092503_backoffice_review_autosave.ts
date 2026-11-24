import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_review_state" AS ENUM('none', 'pending');
  CREATE TYPE "public"."enum__articles_v_version_review_state" AS ENUM('none', 'pending');
  ALTER TABLE "articles" ADD COLUMN "review_state" "enum_articles_review_state" DEFAULT 'none';
  ALTER TABLE "_articles_v" ADD COLUMN "version_review_state" "enum__articles_v_version_review_state" DEFAULT 'none';
  ALTER TABLE "_articles_v" ADD COLUMN "autosave" boolean;
  CREATE INDEX "_articles_v_autosave_idx" ON "_articles_v" USING btree ("autosave");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "_articles_v_autosave_idx";
  ALTER TABLE "articles" DROP COLUMN "review_state";
  ALTER TABLE "_articles_v" DROP COLUMN "version_review_state";
  ALTER TABLE "_articles_v" DROP COLUMN "autosave";
  DROP TYPE "public"."enum_articles_review_state";
  DROP TYPE "public"."enum__articles_v_version_review_state";`)
}
