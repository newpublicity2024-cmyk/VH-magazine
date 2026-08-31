import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'

import { articleUrlFromPath } from '@/lib/routes'

const MAX_DEPTH = 8

type CategoryRef = { slug?: string | null; parent?: unknown } | number | string | null | undefined

/**
 * Resolve a category reference to its full nested path (`moteur/vh-moteur`),
 * walking the parent chain through the Local API.
 *
 * The pure `categoryPath` in lib/routes.ts can only traverse POPULATED parents.
 * An afterChange hook receives whatever depth the mutating request used — often
 * bare ids — so this fetches as it walks. Populated nodes are used as-is, so a
 * deep-populated doc costs no extra queries.
 */
async function resolveCategoryPath(req: PayloadRequest, category: CategoryRef): Promise<string> {
  const segments: string[] = []
  let node: CategoryRef = category
  let depth = 0

  while (node != null && depth < MAX_DEPTH) {
    let doc: { slug?: string | null; parent?: unknown } | null = null

    if (typeof node === 'object') {
      doc = node
    } else {
      doc = (await req.payload.findByID({
        collection: 'categories',
        id: node,
        depth: 0,
        req,
      })) as { slug?: string | null; parent?: unknown } | null
    }

    if (!doc) break
    if (doc.slug) segments.unshift(doc.slug)
    node = (doc.parent ?? null) as CategoryRef
    depth += 1
  }

  return segments.join('/')
}

/**
 * Keep `redirects` in step with published-article URL changes.
 *
 * VH permalinks carry no stable id (they mirror the WordPress URLs exactly), so
 * editing a published article's slug — or re-filing it under another category —
 * breaks every inbound link to it. This hook turns that into a 301.
 *
 * Three things happen, in this order, and the order matters:
 *
 *   1. REPOINT inbound chains. Any redirect already pointing at the old URL is
 *      updated to point at the new one. Without this, renaming twice
 *      (A→B, then B→C) leaves A→B→C: two hops, which search engines discount
 *      and which breaks entirely if the middle row is ever pruned. After this
 *      step the set is always flat: A→C and B→C.
 *   2. UPSERT the redirect for the URL just vacated (old → new).
 *   3. CLEAR any redirect whose source is the NEW url. Reusing a slug that was
 *      previously redirected away would otherwise leave the article redirecting
 *      away from itself — an infinite bounce for the one URL that should resolve.
 *
 * Only fires when the article was published BEFORE the change and is still
 * published after. A draft has no URL in the wild to preserve, so renaming one
 * must produce nothing (asserted by G19).
 *
 * Never throws: the document is already written by the time afterChange runs, so
 * failing here would surface as a save error for a write that actually
 * succeeded. Failures are logged, and the missing row makes G19 fail loudly
 * rather than passing on a silent swallow.
 */
export const syncArticleRedirects: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
  context,
}) => {
  // Escape hatch for callers that are not editors renaming a live article:
  //   - the seed script, which rewrites published docs on every run and would
  //     otherwise manufacture redirects for renames that never happened;
  //   - G19's self-test, which bypasses the hook to prove the gate can fail.
  if (context?.skipRedirects) return doc

  if (operation !== 'update' || !previousDoc) return doc
  if (previousDoc._status !== 'published' || doc._status !== 'published') return doc

  try {
    const [oldPath, newPath] = await Promise.all([
      resolveCategoryPath(req, previousDoc.category as CategoryRef),
      resolveCategoryPath(req, doc.category as CategoryRef),
    ])

    const from = articleUrlFromPath(oldPath, previousDoc.slug as string | null)
    const to = articleUrlFromPath(newPath, doc.slug as string | null)

    if (from === '/' || to === '/' || from === to) return doc

    // 1. Repoint anything that pointed at the vacated URL, so chains stay flat.
    const inbound = await req.payload.find({
      collection: 'redirects',
      where: { to: { equals: from } },
      limit: 100,
      depth: 0,
      req,
    })

    for (const row of inbound.docs) {
      // A row whose `from` is the new URL would become a self-redirect; step 3
      // deletes it, so skip rather than write a doomed value here.
      if ((row as { from?: string }).from === to) continue
      await req.payload.update({
        collection: 'redirects',
        id: (row as { id: number | string }).id,
        data: { to },
        depth: 0,
        req,
      })
    }

    // 2. Upsert old → new.
    const existing = await req.payload.find({
      collection: 'redirects',
      where: { from: { equals: from } },
      limit: 1,
      depth: 0,
      req,
    })

    if (existing.docs.length > 0) {
      await req.payload.update({
        collection: 'redirects',
        id: (existing.docs[0] as { id: number | string }).id,
        data: { to, permanent: true },
        depth: 0,
        req,
      })
    } else {
      await req.payload.create({
        collection: 'redirects',
        data: { from, to, permanent: true, source: 'auto' },
        depth: 0,
        req,
      })
    }

    // 3. The new URL must resolve, never redirect.
    const shadowing = await req.payload.find({
      collection: 'redirects',
      where: { from: { equals: to } },
      limit: 10,
      depth: 0,
      req,
    })

    for (const row of shadowing.docs) {
      await req.payload.delete({
        collection: 'redirects',
        id: (row as { id: number | string }).id,
        req,
      })
    }
  } catch (error) {
    req.payload.logger.error(
      { err: error, article: doc?.id },
      'Échec de la synchronisation des redirections après changement d’URL',
    )
  }

  return doc
}
