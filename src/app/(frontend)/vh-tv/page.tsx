import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { VhTvPlayer, type TvVideo } from '@/components/VhTvPlayer'
import { formatDate, isoDate } from '@/lib/format'
import { getArticlesByCategory } from '@/lib/queries'
import { STATIC_ROUTES, articleUrl } from '@/lib/routes'
import { buildMetadata } from '@/lib/seo'
import { buildSafe } from '@/lib/build-safe'
import { typoFr } from '@/lib/typo-fr'
import type { Media } from '@/payload-types'

export const revalidate = 900

export const metadata: Metadata = buildMetadata({
  title: 'VH TV',
  description: 'Toutes les vidéos de VH Magazine : interviews, festivals, reportages.',
  path: STATIC_ROUTES.vhTv,
})

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

/** VH TV (DESIGN-SPEC-R3 §5.4): a full black page, featured player + video grid. */
export default async function VhTvPage() {
  const articles = await buildSafe(() => getArticlesByCategory('video', 24), [], '/vh-tv/')
  const videos: TvVideo[] = articles.map((a) => {
    const m = asMedia(a.featuredImage)
    return {
      id: a.id as number,
      title: typoFr(a.title),
      href: articleUrl(a as Parameters<typeof articleUrl>[0]),
      date: formatDate(a.publishedAt),
      isoDate: isoDate(a.publishedAt),
      videoUrl: a.videoUrl ?? null,
      image: m?.url ? { url: m.url, width: m.width || 1280, height: m.height || 720, alt: m.alt || a.title } : null,
    }
  })

  return (
    <div className="vh-dark -mb-16 lg:-mb-24">
      <div className="vh-container">
        <Breadcrumbs tone="dark" items={[{ label: 'Accueil', href: '/' }, { label: 'VH TV', href: STATIC_ROUTES.vhTv }]} />
        <h1 className="type-h1-page text-white">
          VH TV<span className="sr-only"> — les vidéos de VH Magazine</span>
        </h1>
        <VhTvPlayer videos={videos} />
      </div>
    </div>
  )
}
