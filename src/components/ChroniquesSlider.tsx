import Image from 'next/image'
import Link from 'next/link'

import { GalleryCarousel } from '@/components/GalleryCarousel'
import { articleUrl } from '@/lib/routes'
import { typoFr } from '@/lib/typo-fr'
import type { Article, Media } from '@/payload-types'

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

/**
 * The side panel's "Chroniques cigare", as vh.ma's sidebar shows it: an autoplaying slider, one
 * chronicle at a time, its title over its photo.
 *
 * Every slide is rendered on the server (crawlers and readers without JavaScript get all five,
 * swipeable). A slide is `data-slide`, never `data-card`: it carries no date (vh.ma's shows none),
 * and the card gates (G9–G11, R3-G9) hold every `data-card` to a visible date.
 */
export function ChroniquesSlider({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null
  return (
    <GalleryCarousel
      count={articles.length}
      label="Chroniques cigare"
      itemName="chronique"
      autoplay={5000}
      loop
    >
      {articles.map((article) => {
        const image = asMedia(article.featuredImage)
        return (
          <div key={article.id} className="vh-carousel__slide" data-slide>
            <Link href={articleUrl(article as never)} className="vh-chronique">
              {image?.url ? (
                <Image
                  src={image.url}
                  alt=""
                  width={image.width || 600}
                  height={image.height || 400}
                  sizes="(min-width: 1024px) 300px, 100vw"
                  loading="lazy"
                  className="vh-chronique__img"
                />
              ) : null}
              <span className="vh-chronique__title type-title">{typoFr(article.title)}</span>
            </Link>
          </div>
        )
      })}
    </GalleryCarousel>
  )
}
