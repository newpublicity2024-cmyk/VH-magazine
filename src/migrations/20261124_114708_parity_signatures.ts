import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "authors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "articles" ADD COLUMN "signature_id" integer;
  ALTER TABLE "_articles_v" ADD COLUMN "version_signature_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "authors_id" integer;
  CREATE UNIQUE INDEX "authors_slug_idx" ON "authors" USING btree ("slug");
  CREATE INDEX "authors_updated_at_idx" ON "authors" USING btree ("updated_at");
  CREATE INDEX "authors_created_at_idx" ON "authors" USING btree ("created_at");
  ALTER TABLE "articles" ADD CONSTRAINT "articles_signature_id_authors_id_fk" FOREIGN KEY ("signature_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_signature_id_authors_id_fk" FOREIGN KEY ("version_signature_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_signature_idx" ON "articles" USING btree ("signature_id");
  CREATE INDEX "_articles_v_version_version_signature_idx" ON "_articles_v" USING btree ("version_signature_id");
  CREATE INDEX "payload_locked_documents_rels_authors_id_idx" ON "payload_locked_documents_rels" USING btree ("authors_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "authors" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "authors" CASCADE;
  ALTER TABLE "articles" DROP CONSTRAINT "articles_signature_id_authors_id_fk";
  
  ALTER TABLE "_articles_v" DROP CONSTRAINT "_articles_v_version_signature_id_authors_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_authors_fk";
  
  DROP INDEX "articles_signature_idx";
  DROP INDEX "_articles_v_version_version_signature_idx";
  DROP INDEX "payload_locked_documents_rels_authors_id_idx";
  ALTER TABLE "articles" DROP COLUMN "signature_id";
  ALTER TABLE "_articles_v" DROP COLUMN "version_signature_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "authors_id";`)
}
