import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" ADD COLUMN "legacy_path" varchar;
  ALTER TABLE "media" ADD COLUMN "legacy_wp_id" numeric;
  CREATE UNIQUE INDEX "media_legacy_path_idx" ON "media" USING btree ("legacy_path");
  CREATE INDEX "media_legacy_wp_id_idx" ON "media" USING btree ("legacy_wp_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "media_legacy_path_idx";
  DROP INDEX "media_legacy_wp_id_idx";
  ALTER TABLE "media" DROP COLUMN "legacy_path";
  ALTER TABLE "media" DROP COLUMN "legacy_wp_id";`)
}
