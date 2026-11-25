import Link from 'next/link'
import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { CategoryBlock } from '@/components/CategoryBlock'
import { CoverGrid } from '@/components/CoverGrid'
import { DossierStrip } from '@/components/DossierStrip'
import { PromoBanner } from '@/components/PromoBanner'
import { SectionTitle } from '@/components/SectionHeader'
import { WithSidebar } from '@/components/WithSidebar'
import { getArticlesByCategory, getBanners, getHomepageGlobal, getIssues, getSiteSettings } from '@/lib/queries'
import { STATIC_ROUTES } from '@/lib/routes'
import { absoluteFileUrl, buildMetadata, ogImageUrl, SITE_URL } from '@/lib/seo'
import { SITE } from '@/lib/site'
import { buildSafe } from '@/lib/build-safe'

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
 * The homepage, in vh.ma's order (spec §5, as amended 2026-11-25).
 *
 * Ten sections, each carrying a `data-section` marker that gate G8 uses to assert both presence
 * and document order: Actu, Lifestyle and Moteur in the main column beside the side panel, then
 * the full-width blocks. Le Club VH (Who's Who), Chroniques cigare, the collector and Cool Drives
 * live in the side panel (components/Sidebar.tsx), as on vh.ma — user instruction 2026-11-25,
 * which supersedes amendment A2's full-width placement of those four. A2 still holds for what
 * remains below: every full-width block is its own stacked section, never paired.
 *
 * All queries fire concurrently — they are independent, and awaiting them in
 * sequence would serialise their round trips into the render.
 */
export default async function HomePage() {
  // One buildSafe around the whole batch rather than ten: if the database is
  // unreachable during a build, every one of these fails for the same reason,
  // and a half-populated homepage would be more confusing than an empty one.
  const [actu, lifestyle, moteur, videos, people, issues, banners, homepage] = await buildSafe(
    () =>
      Promise.all([
        getArticlesByCategory('actualite-news-express-maroc', 4, true),
        getArticlesByCategory('lifestyle-homme-maroc', 4, true),
        getArticlesByCategory('moteur', 4, true),
        getArticlesByCategory('video', 6),
        getArticlesByCategory('people-celebrites', 5),
        getIssues(4),
        getBanners(),
        getHomepageGlobal(),
      ]),
    [[], [], [], [], [], [], {}, {} as Awaited<ReturnType<typeof getHomepageGlobal>>] as const as never,
    'homepage',
  )

  const dossiers = homepage.dossiers || []

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
        {/* ── Two-column region: main column + the side panel (spec §5.1–5.4, 5.5–5.8 as amended) ── */}
        <div className="vh-container">
          <WithSidebar place="home" mainClassName="vh-stack">
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
          </WithSidebar>
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
