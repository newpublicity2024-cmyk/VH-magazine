import { AboutCard } from '@/components/AboutCard'
import { ArticleList } from '@/components/ArticleList'
import { ChroniquesSlider } from '@/components/ChroniquesSlider'
import { InstagramCard } from '@/components/InstagramCard'
import { KiosqueCover } from '@/components/KiosqueCover'
import { NewsletterForm } from '@/components/NewsletterForm'
import { PromoBanner } from '@/components/PromoBanner'
import { SidebarWidget } from '@/components/SidebarWidget'
import { buildSafe } from '@/lib/build-safe'
import {
  getArticlesByCategory,
  getBanners,
  getHomepageGlobal,
  getIssues,
  getLatestArticles,
  getMostRead,
  type RankedArticle,
} from '@/lib/queries'
import type { Article, Banner, Homepage, MagazineIssue } from '@/payload-types'

/** Where the panel stands: the home page hides "Les plus lus" (as vh.ma does); the rest feed the newsletter's `source`. */
export type SidebarPlace = 'home' | 'article' | 'listing' | 'page'

const NEWSLETTER_SOURCE: Record<SidebarPlace, string> = {
  home: 'homepage-sidebar',
  article: 'article-sidebar',
  listing: 'listing-sidebar',
  page: 'page-sidebar',
}

/**
 * The side panel — one panel, the same on every page that has one, as on vh.ma (measured with
 * Playwright 2026-11-25 on its home page, articles, categories, tags, author pages, search, issue
 * pages and /le-luxe/). vh.ma's order, top to bottom:
 *
 *   En kiosque · The Shift Podcast · Newsletter · Instagram · Les plus lus (not on the home page)
 *   · Derniers articles · Le Club VH (→ Who's Who) · Chroniques cigare · Un collector à ne pas
 *   manquer ! · Cool Drives By Rafik Lahlou
 *
 * (vh.ma's two Google Ad Manager slots, between Instagram and Les plus lus and after Le Club VH,
 * are left out: no ad account here.) Like vh.ma's, it is one long column that scrolls with the
 * page — not sticky, no scroll of its own (vh.ma's sticky-sidebar script is never loaded).
 *
 * A widget whose content is missing renders nothing at all, heading included: an empty heading
 * reads as a bug.
 */
export async function Sidebar({ place }: { place: SidebarPlace }) {
  const [issues, banners, mostRead, latest, homepage, cigars] = await buildSafe(
    () =>
      Promise.all([
        getIssues(1),
        getBanners(),
        place === 'home' ? Promise.resolve([] as RankedArticle[]) : getMostRead(5),
        getLatestArticles(5),
        getHomepageGlobal(),
        // vh.ma's Chroniques cigare: the five latest posts filed (in any position) under vitoles-volutes.
        getArticlesByCategory('vitoles-volutes', 5),
      ]),
    [[], {}, [], [], {}, []] as unknown as [
      MagazineIssue[],
      Record<string, Banner>,
      RankedArticle[],
      Article[],
      Homepage,
      Article[],
    ],
    'sidebar',
  )

  // Hand-picked in the admin when set; otherwise vh.ma's own rule.
  const picked = (homepage.chroniquesCigare || []).filter(
    (a): a is Article => typeof a === 'object' && a !== null,
  )
  const chroniques = picked.length ? picked : cigars
  const collector = banners['collector-sport']

  return (
    <aside
      data-region="sidebar"
      data-section="sidebar"
      aria-label="Colonne latérale"
      className="vh-sidebar"
    >
      {/* vh.ma's "En kiosque": the latest issue's cover (falls back to the collector banner) */}
      {issues[0] || banners.collector ? (
        <SidebarWidget title="En kiosque" widgetKey="collector-promo">
          {issues[0] ? (
            <KiosqueCover issue={issues[0]} />
          ) : (
            <PromoBanner banner={banners.collector} />
          )}
        </SidebarWidget>
      ) : null}

      {banners.podcast ? (
        <SidebarWidget title="The Shift Podcast" widgetKey="podcast">
          <PromoBanner banner={banners.podcast} />
        </SidebarWidget>
      ) : null}

      <SidebarWidget widgetKey="newsletter">
        <NewsletterForm source={NEWSLETTER_SOURCE[place]} />
      </SidebarWidget>

      <SidebarWidget title="Instagram" widgetKey="instagram">
        <InstagramCard />
      </SidebarWidget>

      {place !== 'home' && mostRead.length > 0 ? (
        <ArticleList title="Les plus lus" widgetKey="most-read" articles={mostRead} ranked />
      ) : null}
      {latest.length > 0 ? (
        <ArticleList title="Derniers articles" widgetKey="latest-articles" articles={latest} />
      ) : null}

      {/* Le Club VH — vh.ma's untitled image linking to its Who's Who page */}
      {banners['whos-who'] ? (
        <SidebarWidget widgetKey="whos-who">
          <PromoBanner banner={banners['whos-who']} />
        </SidebarWidget>
      ) : null}

      {chroniques.length > 0 ? (
        <SidebarWidget title="Chroniques cigare" widgetKey="chroniques-cigare">
          <ChroniquesSlider articles={chroniques} />
        </SidebarWidget>
      ) : null}

      {collector ? (
        <SidebarWidget
          title={collector.title || 'Un collector à ne pas manquer !'}
          widgetKey="collector"
        >
          <PromoBanner banner={collector} />
        </SidebarWidget>
      ) : null}

      {banners['cool-drives'] ? (
        <SidebarWidget widgetKey="cool-drives">
          <AboutCard banner={banners['cool-drives']} />
        </SidebarWidget>
      ) : null}
    </aside>
  )
}
