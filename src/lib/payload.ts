import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@/payload.config'

/**
 * Cached Payload Local API client for Server Components and route handlers.
 * `cache` dedupes init within a single request — no extra hop to the DB.
 */
export const getPayloadClient = cache(async () => {
  return getPayload({ config: await config })
})
