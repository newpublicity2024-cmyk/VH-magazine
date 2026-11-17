import { blobBaseUrl, blobFileUrl } from './legacy-media'

/**
 * The URL Payload hands out for a Media file, for code that reads media rows with SQL and
 * so never runs Payload's afterRead hooks (live search). The `url` column stores what Payload
 * wrote at import time — the proxy path /api/media/file/<name> — which is not what the site
 * serves once the Blob adapter hands out direct URLs (`disablePayloadAccessControl`).
 *
 * Same switch as payload.config.ts: the adapter is on exactly when BLOB_READ_WRITE_TOKEN is
 * set; the base URL is derived exactly as the adapter derives it (blobBaseUrl). Without a
 * token, files live on local disk behind Payload's own route, encoded as Payload encodes it.
 */
export function mediaFileUrl(filename: string, env: Record<string, string | undefined> = process.env): string {
  const base = env.BLOB_READ_WRITE_TOKEN ? blobBaseUrl(env) : null
  return base ? blobFileUrl(base, filename) : `/api/media/file/${encodeURIComponent(filename)}`
}
