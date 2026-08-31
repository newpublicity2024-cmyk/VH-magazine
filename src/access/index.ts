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
