/**
 * Role-based field visibility for the admin UI.
 *
 * IMPORTANT: `admin.condition` hides a field from the form — it does NOT block an API write.
 * Use it only for fields that are noise to a role rather than a privilege boundary. Anything a
 * role must not write also needs field-level `access` or a hook (Articles.author has both).
 */

type MaybeUser = { role?: string | null } | null | undefined

export const isEditorialUser = (user: MaybeUser): boolean =>
  user?.role === 'admin' || user?.role === 'editor'

/**
 * Shows a field to admins and editors only. A journalist's screen keeps what they decide —
 * title, text, chapô, cover image, rubric, keywords — and loses what is decided for them
 * (slug, SEO, author, date, view count, migration provenance).
 */
export const editorialOnly = (
  _data: unknown,
  _siblingData: unknown,
  { user }: { user?: MaybeUser },
): boolean => isEditorialUser(user)
