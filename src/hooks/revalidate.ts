import { revalidatePath } from 'next/cache'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
} from 'payload'

/**
 * On-publish revalidation. Coarse by design: revalidating the root layout is one
 * cheap call and the homepage aggregates nearly every collection, so tag-level
 * precision would buy little at this size. Tag-based invalidation is a step-7
 * concern if the page count grows.
 *
 * Wrapped in try/catch because the seed script mutates through the Local API
 * outside any request scope, where revalidatePath throws.
 */
export function revalidateSite(): void {
  try {
    revalidatePath('/', 'layout')
  } catch {
    /* outside request scope (e.g. seed script) — ignore */
  }
}

export const revalidateAfterChange: CollectionAfterChangeHook = ({ doc }) => {
  revalidateSite()
  return doc
}

export const revalidateAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  revalidateSite()
  return doc
}

export const revalidateGlobalAfterChange: GlobalAfterChangeHook = ({ doc }) => {
  revalidateSite()
  return doc
}
