import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "grand_angle" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "grand_angle_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"articles_id" integer
  );
  
  ALTER TABLE "grand_angle_rels" ADD CONSTRAINT "grand_angle_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."grand_angle"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "grand_angle_rels" ADD CONSTRAINT "grand_angle_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "grand_angle_rels_order_idx" ON "grand_angle_rels" USING btree ("order");
  CREATE INDEX "grand_angle_rels_parent_idx" ON "grand_angle_rels" USING btree ("parent_id");
  CREATE INDEX "grand_angle_rels_path_idx" ON "grand_angle_rels" USING btree ("path");
  CREATE INDEX "grand_angle_rels_articles_id_idx" ON "grand_angle_rels" USING btree ("articles_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "grand_angle" CASCADE;
  DROP TABLE "grand_angle_rels" CASCADE;`)
}
