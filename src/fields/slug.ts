import type { Field } from 'payload'

/**
 * French slugify, matching the live vh.ma URLs exactly.
 *
 * Diacritics are folded (î→i, é→e, ç→c) and apostrophes are DROPPED rather than
 * turned into separators — that is what WordPress did, and it is why
 * "Porsche, l'icône sous pression" lives at /porsche-licone-sous-pression/.
 * Getting this wrong would silently break SEO continuity on every migrated URL,
 * so it is covered by a unit assertion in the seed verifier.
 */
export const slugify = (value: string): string =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Top-level route segments a category slug must not shadow.
 *
 * Article URLs are rooted (`/{categoryPath}/{slug}/`), so a top-level category
 * slug shares a namespace with every static route. A category slugged `contact`
 * would make /contact/ ambiguous.
 */
export const RESERVED_ROUTE_SLUGS = [
  'category',
  'sommaire',
  'magazine-maroc',
  'vh-tv',
  'contact',
  'rafik-lahlou-team-vh',
  'sondage',
  'recherche',
  'admin',
  'api',
  'media',
] as const

export function isReservedSlug(value: string, extra: readonly string[] = []): boolean {
  return new Set<string>([...RESERVED_ROUTE_SLUGS, ...extra]).has(value)
}

type SlugOptions = {
  /** Reject slugs that would shadow a static route. Use on Categories, not Articles. */
  reserved?: boolean
  reservedExtra?: readonly string[]
  /** Enforce a DB-level unique index (Articles: the route resolves on the slug). */
  unique?: boolean
}

/**
 * A slug field that auto-generates from `sourceField` when empty but stays editable.
 *
 * Unlike the sister sites, VH permalinks carry NO stable numeric id — they must
 * match the WordPress URLs one-for-one. Changing a published article's slug
 * therefore breaks an inbound link, which is exactly why the redirect hook in
 * hooks/redirects.ts exists.
 */
export const slugField = (sourceField = 'title', opts: SlugOptions = {}): Field => ({
  name: 'slug',
  type: 'text',
  label: 'Slug (URL)',
  index: true,
  unique: opts.unique ?? false,
  admin: {
    position: 'sidebar',
    description: 'Généré depuis le titre. Le modifier sur un article publié crée une redirection.',
  },
  hooks: {
    beforeValidate: [
      ({ value, data, siblingData }) => {
        const source = (data?.[sourceField] ?? siblingData?.[sourceField]) as string | undefined
        const raw = (value as string | undefined) || source || ''
        return raw ? slugify(raw) : raw
      },
    ],
  },
  // Payload types a text field's validate value as `string | string[]` (the
  // hasMany case), so the parameter has to accept both even though this field
  // is single-valued — a narrower signature is not assignable under
  // strictFunctionTypes.
  validate: (value: string | string[] | null | undefined) => {
    const slug = Array.isArray(value) ? value[0] : value
    if (!slug) return 'Le slug est obligatoire.'
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return 'Le slug ne peut contenir que des minuscules, des chiffres et des tirets.'
    }
    if (opts.reserved && isReservedSlug(slug, opts.reservedExtra)) {
      return `« ${slug} » est un segment d'URL réservé et rendrait la page inaccessible.`
    }
    return true
  },
})
