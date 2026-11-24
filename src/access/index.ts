import type { Access, FieldAccess, Where } from 'payload'

/**
 * Role model (least privilege), mirroring the sister sites:
 *   admin      — full control over everything.
 *   editor     — manages and publishes all editorial content + taxonomy + media.
 *   journalist — creates and edits ONLY their own drafts; cannot publish.
 */

export const anyone: Access = () => true

export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

export const isAdmin: Access = ({ req: { user } }) => user?.role === 'admin'

export const isAdminOrEditor: Access = ({ req: { user } }) =>
  user?.role === 'admin' || user?.role === 'editor'

/** Admins can act on anyone; everyone else only on their own user document. */
export const isAdminOrSelf: Access = ({ req: { user }, id }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  return user.id === id
}

/** Field-level: only admins may set sensitive fields (e.g. a user's role). */
export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => user?.role === 'admin'

/**
 * Article read access:
 *   - public: published only
 *   - journalist: published, plus their own drafts
 *   - admin/editor: everything
 */
export const canReadArticles: Access = ({ req: { user } }) => {
  if (user?.role === 'admin' || user?.role === 'editor') return true
  if (user) {
    // Annotated rather than inferred: TS widens each `or` member to include the
    // other's key as `undefined`, which Where's index signature rejects.
    const own: Where = {
      or: [{ _status: { equals: 'published' } }, { author: { equals: user.id } }],
    }
    return own
  }
  const published: Where = { _status: { equals: 'published' } }
  return published
}

/** Journalists may only modify their own documents; editors and admins any. */
export const canMutateOwnArticles: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin' || user.role === 'editor') return true
  return { author: { equals: user.id } }
}

/** Only admins and editors may publish. */
export const canPublishFieldLevel: FieldAccess = ({ req: { user } }) =>
  user?.role === 'admin' || user?.role === 'editor'

/** Field-level: admins and editors (e.g. reassigning an article's author). */
export const isAdminOrEditorFieldLevel: FieldAccess = ({ req: { user } }) =>
  user?.role === 'admin' || user?.role === 'editor'

/**
 * Article delete, WordPress's Contributor rule: editors and admins delete anything; a
 * journalist deletes only their OWN article and only while it has never been published.
 *
 * `_status` here is the MAIN row's status. Draft saves never write the main row (Payload
 * writes only a version — payload/dist/collections/operations/utilities/update.js), so the
 * main row reads `published` from the first publish on, even while a newer draft exists.
 * That is exactly the boundary wanted: once a URL has been public, removing it is an
 * editorial decision (it 404s inbound links), not a writer's.
 *
 * Autosave makes this matter: opening « Ajouter » creates the draft immediately, so a
 * journalist who changes their mind needs a way to bin it.
 */
export const canDeleteArticles: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin' || user.role === 'editor') return true
  const ownNeverPublished: Where = {
    and: [{ author: { equals: user.id } }, { _status: { equals: 'draft' } }],
  }
  return ownNeverPublished
}

/**
 * `admin.hidden` predicate: keep a collection or global out of a journalist's nav, dashboard
 * and admin routes. Their access rules already stop them changing anything there; hiding it
 * keeps their screen to what they use (articles and images). REST, the Local API and
 * relationship pickers are unaffected — this is visibility, not permission.
 *
 * `user` is typed loosely on purpose: collections pass a `ClientUser`, globals a
 * `User | null`, and this one predicate serves both signatures.
 */
export const hiddenFromJournalists = ({ user }: { user?: unknown }): boolean =>
  (user as { role?: string } | null | undefined)?.role === 'journalist'
