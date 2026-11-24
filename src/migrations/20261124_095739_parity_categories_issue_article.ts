import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles_rels" ADD COLUMN "categories_id" integer;
  ALTER TABLE "_articles_v_rels" ADD COLUMN "categories_id" integer;
  ALTER TABLE "magazine_issues" ADD COLUMN "article_id" integer;
  ALTER TABLE "magazine_issues" ADD COLUMN "view_count" numeric DEFAULT 0;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "magazine_issues" ADD CONSTRAINT "magazine_issues_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "articles_rels_categories_id_idx" ON "articles_rels" USING btree ("categories_id");
  CREATE INDEX "_articles_v_rels_categories_id_idx" ON "_articles_v_rels" USING btree ("categories_id");
  CREATE INDEX "magazine_issues_article_idx" ON "magazine_issues" USING btree ("article_id");
  CREATE INDEX "magazine_issues_view_count_idx" ON "magazine_issues" USING btree ("view_count");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles_rels" DROP CONSTRAINT "articles_rels_categories_fk";
  
  ALTER TABLE "_articles_v_rels" DROP CONSTRAINT "_articles_v_rels_categories_fk";
  
  ALTER TABLE "magazine_issues" DROP CONSTRAINT "magazine_issues_article_id_articles_id_fk";
  
  DROP INDEX "articles_rels_categories_id_idx";
  DROP INDEX "_articles_v_rels_categories_id_idx";
  DROP INDEX "magazine_issues_article_idx";
  DROP INDEX "magazine_issues_view_count_idx";
  ALTER TABLE "articles_rels" DROP COLUMN "categories_id";
  ALTER TABLE "_articles_v_rels" DROP COLUMN "categories_id";
  ALTER TABLE "magazine_issues" DROP COLUMN "article_id";
  ALTER TABLE "magazine_issues" DROP COLUMN "view_count";`)
}
