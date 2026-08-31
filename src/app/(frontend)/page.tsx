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
import { absoluteUrl, buildMetadata, ogImageUrl, SITE_URL } from '@/lib/seo'
import { SITE } from '@/lib/site'
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
  const [actu, lifestyle, moteur, videos, people, mostRead, latest, issues, banners, homepage] =
    await Promise.all([
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
    ])

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
    logo: absoluteUrl('/vh-logo.svg'),
    sameAs: [
      'https://www.facebook.com/VHMagazineMaroc',
      'https://twitter.com/VH_Magazine',
      'https://www.instagram.com/vh.magazine/',
    ],
  }

  return (
    <div className="vh-container py-6">
      <JsonLd data={webSite} />
      <JsonLd data={organization} />

      {/* Spec §9: exactly one h1. Visually hidden — the live design leads with
          the Actu band, not a page title, but the document still needs a root. */}
      <h1 className="sr-only">VH Magazine — {SITE.tagline}</h1>

      {/* ── Two-column region: main column + sidebar (spec §5.1–5.4) ───────── */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div data-region="main-column" className="space-y-10 lg:col-span-2">
          <CategoryBlock
            sectionKey="actu"
            title="Actu"
            href="/category/actualite-news-express-maroc/"
            articles={actu}
            columns={2}
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

          <ArticleList title="Les plus lus" widgetKey="most-read" articles={mostRead} />
          <ArticleList title="Derniers articles" widgetKey="latest-articles" articles={latest} />
        </aside>
      </div>

      {/* ── Full-width sections, stacked in spec §5 order ──────────────────── */}

      {/* §5.5 */}
      <section data-section="whos-who" className="mt-12" aria-label="Who's Who">
        <PromoBanner banner={banners['whos-who']} sizes="100vw" />
      </section>

      {/* §5.6 */}
      <section data-section="chroniques-cigare" className="mt-12" aria-labelledby="chroniques-heading">
        <div id="chroniques-heading">
          <SectionTitle title="Chroniques cigare" />
        </div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {chroniques.map((article) => (
            <ArticleCard key={article.id} article={article} variant="compact" />
          ))}
        </div>
      </section>

      {/* §5.7 — full width, NOT paired with Cool Drives (amendment A2) */}
      <section data-section="collector" className="mt-12" aria-labelledby="collector-heading">
        <div id="collector-heading">
          <SectionTitle title="Un collector à ne pas manquer !" />
        </div>
        <PromoBanner banner={banners['collector-sport']} sizes="100vw" />
      </section>

      {/* §5.8 — full width, its own section (amendment A2) */}
      <section data-section="cool-drives" className="mt-12" aria-labelledby="cool-drives-heading">
        <div id="cool-drives-heading">
          <SectionTitle title="Cool Drives By Rafik Lahlou" />
        </div>
        <PromoBanner banner={coolDrives} sizes="100vw" />
        {coolDrives?.body ? (
          <p className="mx-auto mt-4 max-w-3xl text-center text-[14px] leading-relaxed text-ink-soft/80">
            {coolDrives.body}
          </p>
        ) : null}
      </section>

      {/* §5.9 */}
      <div className="mt-12">
        <CategoryBlock
          sectionKey="videos"
          title="Vidéos"
          href={STATIC_ROUTES.vhTv}
          articles={videos}
          columns={3}
          variant="video"
          moreLabel="Voir plus"
        />
      </div>

      {/* §5.10 */}
      <section data-section="magazine-banner" className="mt-12" aria-label="Toutes les unes de VH">
        <PromoBanner banner={banners.unes} sizes="100vw" />
      </section>

      {/* §5.11 */}
      <div className="mt-12">
        <CategoryBlock
          sectionKey="people"
          title="People"
          href="/category/people-celebrites/"
          articles={people}
          columns={5}
        />
      </div>

      {/* §5.12 — two strips STACKED full width (amendment A2) */}
      <section data-section="dossiers" className="mt-12 space-y-8" aria-label="Dossiers">
        {banners['le-luxe'] ? (
          <PromoBanner banner={banners['le-luxe']} sizes="100vw" />
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

      {/* §5.13 */}
      <section data-section="unes" className="mt-12" aria-labelledby="unes-heading">
        <div id="unes-heading">
          <SectionTitle title="Toutes nos unes" href={STATIC_ROUTES.lesUnes} />
        </div>
        <CoverGrid issues={issues} />
        <div className="mt-5 flex justify-center">
          <Link
            href={STATIC_ROUTES.lesUnes}
            className="border border-ink px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-white"
          >
            Voir plus
          </Link>
        </div>
      </section>
    </div>
  )
}
