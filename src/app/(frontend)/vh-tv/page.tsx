import type { Metadata } from 'next'

import { ArticleCard } from '@/components/ArticleCard'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { SectionTitle } from '@/components/SectionHeader'
import { getArticlesByCategory } from '@/lib/queries'
import { STATIC_ROUTES } from '@/lib/routes'
import { buildMetadata } from '@/lib/seo'
import { buildSafe } from '@/lib/build-safe'

export const revalidate = 900

export const metadata: Metadata = buildMetadata({
  title: 'VH TV',
  description: 'Toutes les vidéos de VH Magazine : interviews, festivals, reportages.',
  path: STATIC_ROUTES.vhTv,
})

export default async function VhTvPage() {
  const videos = await buildSafe(() => getArticlesByCategory('video', 24), [], '/vh-tv/')
  return (
    <div className="vh-container py-6">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'VH TV', href: STATIC_ROUTES.vhTv }]} />
      <h1 className="sr-only">VH TV — les vidéos de VH Magazine</h1>
      <SectionTitle title="Vidéos" />
      <div data-video-grid className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v, i) => (
          <ArticleCard key={v.id} article={v} variant="video" priority={i === 0} />
        ))}
      </div>
    </div>
  )
}
