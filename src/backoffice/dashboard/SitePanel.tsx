import type { CollectionSlug, WidgetServerProps } from 'payload'

import type { User } from '@/payload-types'

import { ADMIN, Icons, isEditorial, numberLabel } from './shared'

type Part = {
  key: string
  href: string
  icon: React.ReactNode
  label: string
  hint: string
  /** Counted collection; a global has no count. */
  count?: CollectionSlug
  adminOnly?: boolean
}

/**
 * « Gérer le site »: every part of vh.ma the back office manages, by what it is FOR rather
 * than its collection name, each with its size. WordPress's left menu, laid out as doors.
 * Grouped as the nav is (src/payload.config.ts), so the panel and the menu teach one map.
 */
const GROUPS: Array<{ title: string; parts: Part[] }> = [
  {
    title: 'Rédaction',
    parts: [
      {
        key: 'articles',
        href: `${ADMIN}/collections/articles`,
        icon: <Icons.draft />,
        label: 'Articles',
        hint: 'Écrire, relire, publier',
        count: 'articles',
      },
      {
        key: 'media',
        href: `${ADMIN}/collections/media`,
        icon: <Icons.image />,
        label: 'Médiathèque',
        hint: 'Photos, vidéos, PDF',
        count: 'media',
      },
      {
        key: 'magazine-issues',
        href: `${ADMIN}/collections/magazine-issues`,
        icon: <Icons.book />,
        label: 'Numéros du magazine',
        hint: 'Couvertures et sommaires',
        count: 'magazine-issues',
      },
    ],
  },
  {
    title: 'Classement',
    parts: [
      {
        key: 'categories',
        href: `${ADMIN}/collections/categories`,
        icon: <Icons.folder />,
        label: 'Rubriques',
        hint: 'Sections et URL du site',
        count: 'categories',
      },
      {
        key: 'tags',
        href: `${ADMIN}/collections/tags`,
        icon: <Icons.tag />,
        label: 'Mots-clés',
        hint: 'Relient les articles entre eux',
        count: 'tags',
      },
      {
        key: 'authors',
        href: `${ADMIN}/collections/authors`,
        icon: <Icons.pen />,
        label: 'Signatures',
        hint: 'Les noms qui signent les articles',
        count: 'authors',
      },
    ],
  },
  {
    title: 'Mise en page',
    parts: [
      {
        key: 'homepage',
        href: `${ADMIN}/globals/homepage`,
        icon: <Icons.home />,
        label: 'Page d’accueil',
        hint: 'Chroniques cigare et dossiers',
      },
      {
        key: 'grand-angle',
        href: `${ADMIN}/globals/grand-angle`,
        icon: <Icons.book />,
        label: 'Page Grand Angle',
        hint: 'Les dossiers mis en avant',
      },
      {
        key: 'banners',
        href: `${ADMIN}/collections/banners`,
        icon: <Icons.megaphone />,
        label: 'Bannières',
        hint: 'Collector, podcast, Cool Drives…',
        count: 'banners',
      },
    ],
  },
  {
    title: 'Lecteurs',
    parts: [
      {
        key: 'contact-messages',
        href: `${ADMIN}/collections/contact-messages`,
        icon: <Icons.mail />,
        label: 'Messages de contact',
        hint: 'Envoyés depuis la page Contact',
        count: 'contact-messages',
      },
      {
        key: 'newsletter-subscribers',
        href: `${ADMIN}/collections/newsletter-subscribers`,
        icon: <Icons.newsletter />,
        label: 'Abonnés newsletter',
        hint: 'La liste d’envoi',
        count: 'newsletter-subscribers',
      },
    ],
  },
  {
    title: 'Réglages',
    parts: [
      {
        key: 'site-settings',
        href: `${ADMIN}/globals/site-settings`,
        icon: <Icons.settings />,
        label: 'Paramètres du site',
        hint: 'Nom, réseaux sociaux, kit média',
      },
      {
        key: 'redirects',
        href: `${ADMIN}/collections/redirects`,
        icon: <Icons.redirect />,
        label: 'Redirections',
        hint: 'Anciennes URL vers les nouvelles',
        count: 'redirects',
      },
      {
        key: 'users',
        href: `${ADMIN}/collections/users`,
        icon: <Icons.users />,
        label: 'Utilisateurs',
        hint: 'L’équipe et ses rôles',
        count: 'users',
        adminOnly: true,
      },
    ],
  },
]

export default async function SitePanel({ req }: WidgetServerProps) {
  const { payload } = req
  const user = req.user as User | null
  if (!user || !isEditorial(user)) return null

  const groups = GROUPS.map((g) => ({
    ...g,
    parts: g.parts.filter((p) => !p.adminOnly || user.role === 'admin'),
  }))
  const counted = groups.flatMap((g) => g.parts).filter((p) => p.count)
  const totals = new Map<string, number>(
    await Promise.all(
      counted.map(async (p) => {
        const r = await payload.count({
          collection: p.count as CollectionSlug,
          user,
          overrideAccess: false,
        })
        return [p.key, r.totalDocs] as const
      }),
    ),
  )

  return (
    <section className="vhb-card vhb-site" data-widget="vh-site" aria-label="Gérer le site">
      <header className="vhb-card__head">
        <h2 className="vhb-card__title">
          <span className="vhb-card__icon">
            <Icons.settings />
          </span>
          Gérer le site
        </h2>
        <a className="vhb-link" href="/" target="_blank" rel="noreferrer">
          Voir le site
        </a>
      </header>
      <div className="vhb-site__groups">
        {groups.map((g) => (
          <div key={g.title} className="vhb-site__group">
            <h3 className="vhb-site__group-title">{g.title}</h3>
            <ul className="vhb-site__parts">
              {g.parts.map((p) => (
                <li key={p.key}>
                  <a
                    className="vhb-part"
                    href={p.href}
                    data-part={p.key}
                    data-count={totals.get(p.key) ?? ''}
                  >
                    <span className="vhb-part__icon">{p.icon}</span>
                    <span className="vhb-part__text">
                      <span className="vhb-part__label">{p.label}</span>
                      <span className="vhb-part__hint">{p.hint}</span>
                    </span>
                    {totals.has(p.key) && (
                      <span className="vhb-part__count">{numberLabel(totals.get(p.key) ?? 0)}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
