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
  // The back office's draft preview (/apercu/{id}/). A top-level category of that name would
  // also make /apercu/{slug}/ a two-segment article URL the static route shadows.
  'apercu',
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
  /** Drafts-enabled collections with a publication date: regenerate from the source field
   *  until the document is first published (see the hook). Articles only. */
  followSourceUntilPublished?: boolean
  /** Shown under the field. */
  description?: string
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
    description:
      opts.description ??
      'Généré depuis le titre. Le modifier sur un article publié crée une redirection.',
  },
  hooks: {
    beforeValidate: [
      ({ value, data, siblingData, originalDoc }) => {
        const source = (siblingData?.[sourceField] ?? data?.[sourceField]) as string | undefined
        const incoming = typeof value === 'string' ? value.trim() : ''

        // A draft's slug follows its title until the article is first published.
        //
        // With autosave on, the first save happens while the title is still being typed:
        // left alone, « Le » would freeze the URL at /moteur/le/. So while the article has
        // never been published (no publication date — Articles stamps one on first publish),
        // a slug that is empty or still the one generated from the previous title is
        // regenerated from the current title. A slug someone typed by hand differs from that
        // generated one and is kept. From the first publish on, the URL is public and only an
        // explicit edit changes it (which the redirect hook then turns into a 301).
        //
        // `originalDoc` is the latest version, which for a draft holds the previous title and
        // slug; the form receives the server's slug back after each autosave
        // (`acceptValues: { overrideLocalChanges: false }` in Payload's Autosave).
        if (opts.followSourceUntilPublished && originalDoc && !originalDoc.publishedAt) {
          const previous = typeof originalDoc.slug === 'string' ? originalDoc.slug : ''
          const generated = slugify(String(originalDoc[sourceField] ?? ''))
          const untouched =
            !incoming || (incoming === previous && (previous === '' || previous === generated))
          if (untouched) return slugify(source ?? '') || null
        }

        // NULL, never '', when there is nothing to slug: `articles.slug` is unique, Postgres
        // admits any number of NULLs but only one '', and with autosave every « Ajouter »
        // creates an untitled draft at once — the second one would fail on ''.
        const raw = incoming || source || ''
        return (raw ? slugify(raw) : '') || null
      },
    ],
  },
  // Payload types a text field's validate value as `string | string[]` (the
  // hasMany case), so the parameter has to accept both even though this field
  // is single-valued — a narrower signature is not assignable under
  // strictFunctionTypes.
  validate: (
    value: string | string[] | null | undefined,
    { siblingData }: { siblingData?: Record<string, unknown> } = {},
  ) => {
    const slug = Array.isArray(value) ? value[0] : value
    if (!slug) {
      // In the browser the slug may still be empty while the title is not — the server
      // derives it from the title in beforeValidate, before this runs again there. Refusing
      // here would block an editor who publishes before the first autosave came back.
      const source = siblingData?.[sourceField]
      if (typeof source === 'string' && slugify(source)) return true
      return 'Le slug est obligatoire.'
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return 'Le slug ne peut contenir que des minuscules, des chiffres et des tirets.'
    }
    if (opts.reserved && isReservedSlug(slug, opts.reservedExtra)) {
      return `« ${slug} » est un segment d'URL réservé et rendrait la page inaccessible.`
    }
    return true
  },
})
