import { APIError, ValidationError } from 'payload'
import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
} from 'payload'

import { missingForReview } from '../lib/review'
import { revalidateSite } from './revalidate'

/**
 * Article workflow hooks — the server half of the back office's rules. The admin only
 * reflects these (PublishControl, PublishBox, the checklist); every rule is enforced here,
 * because a hidden button is not a permission.
 */

const CONTEXT_KEY = 'vhArticleDraftWrite'

const idOf = (value: unknown): number | string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') return ((value as { id?: number | string }).id ?? null) as never
  return value as number | string
}

/**
 * Record whether this update is a DRAFT write — one Payload stores as a version only.
 *
 * Payload's own rule (collections/operations/utilities/update.js): `isSavingDraft =
 * draftArg && data._status !== 'published'`, and then it skips `db.updateOne` on the main
 * row. The public site reads only main rows, so such a write cannot change anything a reader
 * sees. The afterChange hook has no `draft` argument, so this is the one place it is known;
 * it travels to `revalidateArticle` through `req.context`.
 */
export const markDraftWrite: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if (operation === 'update' || operation === 'create') {
    const a = args as { draft?: boolean; data?: { _status?: string } }
    req.context[CONTEXT_KEY] = Boolean(a.draft) && a.data?._status !== 'published'
  } else if (operation === 'restoreVersion') {
    // restoreVersion.js writes the main row unless it restores AS a draft.
    req.context[CONTEXT_KEY] = Boolean((args as { draft?: boolean }).draft)
  }
  return args
}

/**
 * The newsroom rules, in the order they must apply:
 *
 * 1. A journalist never publishes. Any publish attempt is turned back into a draft rather
 *    than refused, so their work is saved either way (the rule since round 1).
 *    And a journalist never changes what readers see: a write that would reach the LIVE row
 *    of a published article (a non-draft save, « Dépublier », a non-draft version restore) is
 *    refused. Payload decides draft-or-live from the request BEFORE any hook runs, so turning
 *    `_status` into 'draft' here would not make it a draft save — it would write the journalist's
 *    text to the live row as an unpublished article. Draft saves and « Soumettre pour
 *    relecture » are unaffected: the editor publishes the change.
 * 2. A journalist's article is always theirs: `author` is forced to the saving journalist on
 *    every write. Without this, a journalist could file a draft under a colleague's name — and
 *    then lose access to it, since they may only edit their own.
 * 3. Publishing clears the review flag: the article is no longer waiting for anyone.
 * 4. Entering review requires a complete article. The transition is checked, not the state,
 *    so an autosave of an already-submitted article never fails mid-sentence.
 * 5. Publishing dates the article at that moment unless a date was set (WordPress's « Publier
 *    immédiatement »). New articles start with no date, so a draft written on Monday and
 *    published on Friday is dated Friday instead of carrying the day it was opened.
 */
export const applyArticleWorkflow: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
  operation,
}) => {
  const user = req.user as { id: number | string; role?: string } | null | undefined
  const next = { ...data }

  if (
    user?.role === 'journalist' &&
    operation === 'update' &&
    req.context[CONTEXT_KEY] !== true &&
    originalDoc?.id != null
  ) {
    const live = (await req.payload.db.findOne({
      collection: 'articles',
      where: { id: { equals: originalDoc.id } },
      req,
    })) as { _status?: string } | null
    if (live?._status === 'published') {
      throw new APIError(
        'Cet article est en ligne : seule la rédaction en chef peut changer sa version publiée. Enregistrez vos modifications en brouillon, puis soumettez-les pour relecture.',
        403,
      )
    }
  }

  if (user?.role === 'journalist') {
    if (next._status === 'published') next._status = 'draft'
    next.author = user.id
  } else if (operation === 'create' && !idOf(next.author) && user) {
    next.author = user.id
  }

  if (next._status === 'published') {
    next.reviewState = 'none'
  } else if (next.reviewState === 'pending' && originalDoc?.reviewState !== 'pending') {
    // Judge the article as it will be stored: incoming values over the previous ones.
    const merged = { ...(originalDoc ?? {}), ...next }
    const missing = missingForReview(merged)
    if (missing.length > 0) {
      throw new ValidationError({
        collection: 'articles',
        errors: missing.map(({ path, message }) => ({ path, message })),
        id: originalDoc?.id,
        req,
      })
    }
  }

  if (next._status === 'published') {
    const sent = next.publishedAt
    const explicitlyEmpty = sent === null || sent === ''
    const absentAndNeverDated = sent === undefined && !originalDoc?.publishedAt
    if (explicitlyEmpty || absentAndNeverDated) next.publishedAt = new Date().toISOString()
  }

  return next
}

/**
 * Purge the site cache only when a reader could see the change.
 *
 * The old hook purged on every save. With autosave on, that would have emptied the whole ISR
 * cache every few seconds for as long as anyone typed — each article page then re-rendering
 * from the database on its next view. A draft write (see `markDraftWrite`) and a draft
 * creation never reach a main row a reader can see, so they purge nothing. Publishing,
 * unpublishing and any non-draft edit still purge everything (`revalidatePath('/', 'layout')`),
 * exactly as before.
 */
export const revalidateArticle: CollectionAfterChangeHook = ({ doc, operation, context }) => {
  const draftWrite = context?.[CONTEXT_KEY] === true
  const invisibleCreate = operation === 'create' && doc?._status !== 'published'
  if (!draftWrite && !invisibleCreate) revalidateSite()
  return doc
}
