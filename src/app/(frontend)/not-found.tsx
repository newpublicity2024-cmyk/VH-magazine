import { ArticleCard } from '@/components/ArticleCard'
import { SectionTitle } from '@/components/SectionHeader'
import { buildSafe } from '@/lib/build-safe'
import { getLatestArticles } from '@/lib/queries'
import { STATIC_ROUTES } from '@/lib/routes'

/**
 * The designed 404 (DESIGN-SPEC-R3 §5.7): what happened in one line, a search field, and
 * the six latest articles, so a dead link still leads somewhere. The status stays 404
 * (G37) — Next serves this page for every notFound().
 */
export default async function NotFound() {
  const latest = await buildSafe(() => getLatestArticles(6), [], 'not-found')

  return (
    <div data-not-found className="vh-container pt-12 lg:pt-20">
      <div className="mx-auto max-w-[45rem] text-center">
        <p className="type-kicker text-accent">Erreur 404</p>
        <h1 className="type-h1-page mt-3 text-ink">Page introuvable</h1>
        <p className="type-copy mt-4 text-ink-2">
          Cette page a peut-être été déplacée ou n’existe plus. Cherchez un article, ou reprenez la lecture
          ci-dessous.
        </p>
        <form role="search" action={STATIC_ROUTES.recherche} method="get" className="mx-auto mt-8 flex max-w-[30rem] gap-2">
          <label htmlFor="vh-404-q" className="sr-only">
            Rechercher un article
          </label>
          <input id="vh-404-q" name="q" type="search" required placeholder="Rechercher un article…" className="vh-input type-copy" />
          <button type="submit" className="vh-button-solid type-button shrink-0">
            Chercher
          </button>
        </form>
      </div>

      {latest.length > 0 ? (
        <section data-not-found-latest className="mt-16 lg:mt-20" aria-labelledby="latest-404">
          <SectionTitle title="Derniers articles" id="latest-404" />
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((a) => (
              <ArticleCard key={a.id} article={a} kicker />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
