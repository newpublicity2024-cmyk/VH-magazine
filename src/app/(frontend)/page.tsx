import Link from 'next/link'
import type { Metadata } from 'next'

import { ArticleCard } from '@/components/ArticleCard'
import { JsonLd } from '@/components/JsonLd'
import { ArticleList } from '@/components/ArticleList'
import { CategoryBlock } from '@/components/CategoryBlock'
import { CoverGrid } from '@/components/CoverGrid'
import { DossierStrip } from '@/components/DossierStrip'
import { InstagramCard } from '@/components/InstagramCard'
import { NewsletterForm } from '@/components/NewsletterForm'
import { PromoBanner } from '@/components/PromoBanner'
import { SectionTitle } from '@/components/SectionHeader'
import { SidebarWidget } from '@/components/SidebarWidget'
import {
  getArticlesByCategory,
  getBanners,
  getHomepageGlobal,
  getIssues,
  getLatestArticles,
  getMostRead,
  getSiteSettings,
} from '@/lib/queries'
import { STATIC_ROUTES } from '@/lib/routes'
import { absoluteFileUrl, buildMetadata, ogImageUrl, SITE_URL } from '@/lib/seo'
import { SITE } from '@/lib/site'
import { typoFr } from '@/lib/typo-fr'
import { buildSafe } from '@/lib/build-safe'
import type { Article } from '@/payload-types'

/** Spec §9: homepage revalidates roughly every five minutes. */
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings().catch(() => null)
  return buildMetadata({
    title: 'VH Magazine Maroc | VH Magazine',
    description: settings?.description || SITE.description,
    // Amendment A4: absoluteUrl normalises this to exactly `${SITE_URL}/`.
    path: '/',
    image: ogImageUrl((settings?.defaultOgImage as { url?: string } | null) ?? null),
    type: 'website',
  })
}

/**
 * The homepage, assembled in the exact order of spec §5.
 *
 * Fourteen sections, each carrying a `data-section` marker that gate G8 uses to
 * assert both presence and document order. Amendment A2 applies throughout:
 * every full-width block below the two-column region is its own stacked
 * section, never paired side-by-side.
 *
 * All queries fire concurrently — they are independent, and awaiting them in
 * sequence would serialise fourteen round trips into the render.
 */
export default async function HomePage() {
  // One buildSafe around the whole batch rather than ten: if the database is
  // unreachable during a build, every one of these fails for the same reason,
  // and a half-populated homepage would be more confusing than an empty one.
  const [actu, lifestyle, moteur, videos, people, mostRead, latest, issues, banners, homepage] =
    await buildSafe(
      () =>
        Promise.all([
          getArticlesByCategory('actualite-news-express-maroc', 4),
          getArticlesByCategory('lifestyle-homme-maroc', 4),
          getArticlesByCategory('moteur', 4),
          getArticlesByCategory('video', 6),
          getArticlesByCategory('people-celebrites', 5),
          getMostRead(5),
          getLatestArticles(5),
          getIssues(4),
          getBanners(),
          getHomepageGlobal(),
        ]),
      [[], [], [], [], [], [], [], [], {}, {} as Awaited<ReturnType<typeof getHomepageGlobal>>] as const as never,
      'homepage',
    )

  const chroniques = (homepage.chroniquesCigare || []).filter(
    (a): a is Article => typeof a === 'object' && a !== null,
  )
  const dossiers = homepage.dossiers || []
  const coolDrives = banners['cool-drives']

  const webSite = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: `${SITE_URL}/`,
    inLanguage: 'fr',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/recherche/?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    legalName: SITE.legalName,
    url: `${SITE_URL}/`,
    logo: absoluteFileUrl('/vh-logo.svg'),
    sameAs: [
      'https://www.facebook.com/VHMagazineMaroc',
      'https://twitter.com/VH_Magazine',
      'https://www.instagram.com/vh.magazine/',
    ],
  }

  return (
    <div className="pt-8 pb-4 lg:pt-12">
      <JsonLd data={webSite} />
      <JsonLd data={organization} />

      {/* Spec §9: exactly one h1. Visually hidden — the design leads with the Actu band,
          not a page title, but the document still needs a root. */}
      <h1 className="sr-only">VH Magazine — {SITE.tagline}</h1>

      <div className="vh-stack">
        {/* ── Two-column region: main column + sidebar (spec §5.1–5.4) ─────── */}
        <div className="vh-container">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div data-region="main-column" className="vh-stack">
              <CategoryBlock
                sectionKey="actu"
                title="Actu"
                href="/category/actualite-news-express-maroc/"
                articles={actu}
                layout="lead"
                priorityFirst
              />
              <CategoryBlock
                sectionKey="lifestyle"
                title="Lifestyle"
                href="/category/lifestyle-homme-maroc/"
                articles={lifestyle}
                columns={2}
              />
              <CategoryBlock
                sectionKey="moteur"
                title="Moteur"
                href="/category/moteur/"
                articles={moteur}
                columns={2}
              />
            </div>

            <aside data-region="sidebar" data-section="sidebar" aria-label="Colonne latérale">
              <SidebarWidget title="Numéro collector" widgetKey="collector-promo">
                <PromoBanner banner={banners.collector} />
              </SidebarWidget>

              <SidebarWidget title="The Shift Podcast" widgetKey="podcast">
                <PromoBanner banner={banners.podcast} />
              </SidebarWidget>

              <SidebarWidget widgetKey="newsletter">
                <NewsletterForm />
              </SidebarWidget>

              <SidebarWidget title="Instagram" widgetKey="instagram">
                <InstagramCard />
              </SidebarWidget>

              <ArticleList title="Les plus lus" widgetKey="most-read" articles={mostRead} ranked />
              <ArticleList title="Derniers articles" widgetKey="latest-articles" articles={latest} />
            </aside>
          </div>
        </div>

        {/* ── Full-width sections, stacked in spec §5 order (amendment A2) ──── */}
        <div className="vh-container vh-stack">
          {/* §5.5 */}
          <section data-section="whos-who" aria-label="Who's Who">
            <PromoBanner banner={banners['whos-who']} sizes="(min-width: 1240px) 1176px, 100vw" />
          </section>

          {/* §5.6 */}
          <section data-section="chroniques-cigare" aria-labelledby="chroniques-heading">
            <SectionTitle title="Chroniques cigare" id="chroniques-heading" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-5">
              {chroniques.map((article) => (
                <ArticleCard key={article.id} article={article} variant="compact" />
              ))}
            </div>
          </section>

          {/* §5.7 — full width, NOT paired with Cool Drives (amendment A2) */}
          <section data-section="collector" aria-labelledby="collector-heading">
            <SectionTitle title="Un collector à ne pas manquer !" id="collector-heading" />
            <PromoBanner banner={banners['collector-sport']} sizes="(min-width: 1240px) 1176px, 100vw" />
          </section>

          {/* §5.8 — its own section (amendment A2) */}
          <section data-section="cool-drives" aria-labelledby="cool-drives-heading">
            <SectionTitle title="Cool Drives By Rafik Lahlou" id="cool-drives-heading" />
            <PromoBanner banner={coolDrives} sizes="(min-width: 1240px) 1176px, 100vw" />
            {coolDrives?.body ? (
              <p className="type-copy mx-auto mt-6 max-w-[45rem] text-center text-ink-2">{typoFr(coolDrives.body)}</p>
            ) : null}
          </section>
        </div>

        {/* §5.9 — on black, edge to edge (decision D5) */}
        <CategoryBlock
          sectionKey="videos"
          title="Vidéos"
          href={STATIC_ROUTES.vhTv}
          articles={videos}
          columns={3}
          variant="video"
          tone="dark"
        />

        {/* §5.10 */}
        <div className="vh-container">
          <section data-section="magazine-banner" aria-label="Toutes les unes de VH">
            <PromoBanner banner={banners.unes} sizes="(min-width: 1240px) 1176px, 100vw" />
          </section>
        </div>

        {/* §5.11 — on black (D5) */}
        <CategoryBlock
          sectionKey="people"
          title="People"
          href="/category/people-celebrites/"
          articles={people}
          columns={5}
          tone="dark"
        />

        <div className="vh-container vh-stack">
          {/* §5.12 — strips STACKED full width (amendment A2) */}
          <section data-section="dossiers" className="space-y-16" aria-label="Dossiers">
            {banners['le-luxe'] ? (
              <PromoBanner banner={banners['le-luxe']} sizes="(min-width: 1240px) 1176px, 100vw" />
            ) : null}
            {dossiers.map((dossier, index) => (
              <DossierStrip
                key={dossier.id || index}
                title={dossier.title}
                body={dossier.body}
                linkUrl={dossier.linkUrl}
                linkLabel={dossier.linkLabel}
                image={dossier.image}
              />
            ))}
          </section>

          {/* §5.13 — hidden entirely when there are no issues (migration decision pending) */}
          {issues.length > 0 ? (
            <section data-section="unes" aria-labelledby="unes-heading">
              <SectionTitle title="Toutes nos unes" href={STATIC_ROUTES.lesUnes} id="unes-heading" />
              <CoverGrid issues={issues} />
              <div className="mt-10 flex justify-center">
                <Link data-button href={STATIC_ROUTES.lesUnes} className="vh-button type-button">
                  Voir plus
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
