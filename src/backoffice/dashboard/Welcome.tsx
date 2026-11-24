import type { WidgetServerProps } from 'payload'

import type { User } from '@/payload-types'

import {
  ADMIN,
  ARTICLES,
  firstNameOf,
  greeting,
  Icons,
  isEditorial,
  listHref,
  pendingWhere,
  todayLabel,
  whereHref,
} from './shared'

/**
 * The dashboard's first line: who you are, what day it is, and the one thing a journalist
 * opens the back office for — writing. Editors get the doors to review and to the site.
 * The heading keeps the word « Bonjour »/« Bonsoir » that the back-office gates look for.
 */
export default function Welcome({ req }: WidgetServerProps) {
  const user = req.user as User | null
  if (!user) return null
  const editorial = isEditorial(user)

  return (
    <section className="vhb-card vhb-welcome" data-widget="vh-welcome" aria-label="Bienvenue">
      <div className="vhb-welcome__text">
        <p className="vhb-welcome__date">{todayLabel()}</p>
        <h2 className="vhb-welcome__title">
          {greeting()} {firstNameOf(user)}
        </h2>
        <p className="vhb-welcome__sub">
          {editorial
            ? 'Relisez les articles de l’équipe, publiez-les et gérez tout le site depuis ce tableau de bord.'
            : 'Écrivez votre article : il s’enregistre tout seul. Quand il est prêt, soumettez-le à la rédaction en chef, qui le relit et le publie.'}
        </p>
      </div>
      <nav className="vhb-welcome__actions" aria-label="Actions rapides">
        <a className="vhb-btn vhb-btn--primary vhb-btn--lg" href={`${ARTICLES}/create`}>
          <Icons.pen />
          Écrire un article
        </a>
        {editorial ? (
          <a
            className="vhb-btn vhb-btn--ghost vhb-btn--lg"
            href={whereHref(ARTICLES, pendingWhere(user))}
          >
            <Icons.inbox />
            Articles à relire
          </a>
        ) : (
          <>
            <a
              className="vhb-btn vhb-btn--ghost vhb-btn--lg"
              href={listHref(ARTICLES, [['author', 'equals', String(user.id)]])}
            >
              <Icons.draft />
              Mes articles
            </a>
            <a className="vhb-btn vhb-btn--ghost vhb-btn--lg" href={`${ADMIN}/collections/media`}>
              <Icons.image />
              Médiathèque
            </a>
            <a className="vhb-btn vhb-btn--ghost vhb-btn--lg" href={`${ADMIN}/account`}>
              <Icons.user />
              Mon compte
            </a>
          </>
        )}
      </nav>
    </section>
  )
}
