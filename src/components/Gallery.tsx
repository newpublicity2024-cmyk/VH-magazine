import Image from 'next/image'
import type { CSSProperties, ReactNode } from 'react'

import { GalleryCarousel } from '@/components/GalleryCarousel'
import { GalleryZoom } from '@/components/GalleryZoom'
import {
  balancedRows,
  galleryColumns,
  type GalleryLayout,
  type GalleryPhoto,
} from '@/lib/gallery'
import { typoFr } from '@/lib/typo-fr'

export type { GalleryPhoto }

/**
 * The « Galerie photos » block on the public page (blocks/Gallery.ts) — six layouts.
 *
 * Server-rendered markup, styled in styles.css (`.vh-gallery`): grid and mosaic crop to one
 * shape; columns, side-by-side and full-width keep every photo's proportions (its real
 * width/height reach next/image, so the box is reserved before it loads — spec §9, gate G14).
 * Side-by-side rows get one height by giving each photo a flex share equal to its aspect ratio.
 *
 * Client code only where a reader acts: the slideshow's arrows (GalleryCarousel) and the
 * lightbox, whose own code loads on the first click (GalleryZoom). Every image is lazy — a
 * gallery is never the LCP element.
 */
export function Gallery({
  layout,
  columns,
  photos,
  caption,
  lightbox = true,
}: {
  layout: GalleryLayout
  columns?: unknown
  photos: GalleryPhoto[]
  caption?: string | null
  lightbox?: boolean
}) {
  if (!photos.length) return null
  const count = photos.length
  const cols = galleryColumns(layout, columns, count)
  const sizes =
    layout === 'stack' || layout === 'carousel' || cols === 1
      ? '(min-width: 1024px) 720px, 100vw'
      : `(min-width: 1024px) ${Math.round(720 / cols)}px, ${cols >= 2 ? 50 : 100}vw`

  const picture = (p: GalleryPhoto, i: number, lead = false): ReactNode => {
    const image = (
      <Image
        src={p.url}
        alt={p.alt}
        width={p.width}
        height={p.height}
        sizes={lead ? '(min-width: 1024px) 720px, 100vw' : sizes}
        loading="lazy"
        data-fade
        className="vh-gallery__img"
      />
    )
    if (!lightbox) return image
    return (
      <button
        type="button"
        className="vh-gallery__zoom"
        data-zoom={i}
        aria-haspopup="dialog"
        aria-label={`Agrandir la photo ${i + 1} sur ${count}${p.alt ? ` : ${p.alt}` : ''}`}
      >
        {image}
      </button>
    )
  }

  const item = (p: GalleryPhoto, i: number, style?: CSSProperties, lead = false) => (
    <figure key={`${p.url}-${i}`} className="vh-gallery__item" data-gallery-item={i} style={style}>
      {picture(p, i, lead)}
      {p.caption ? <figcaption>{typoFr(p.caption)}</figcaption> : null}
    </figure>
  )

  let body: ReactNode
  if (layout === 'carousel') {
    body = (
      <GalleryCarousel count={count} label={`Diaporama de ${count} photos`}>
        {photos.map((p, i) => (
          <figure
            key={`${p.url}-${i}`}
            className="vh-carousel__slide"
            data-gallery-item={i}
            role="group"
            aria-roledescription="diapositive"
            aria-label={`${i + 1} sur ${count}`}
          >
            <div className="vh-carousel__media">{picture(p, i, true)}</div>
            {p.caption ? <figcaption>{typoFr(p.caption)}</figcaption> : null}
          </figure>
        ))}
      </GalleryCarousel>
    )
  } else if (layout === 'row') {
    body = balancedRows(
      photos.map((p, i) => ({ p, i })),
      cols,
    ).map((row, r) => (
      <div key={r} className="vh-gallery__row" data-gallery-row={r}>
        {/* flex-grow = aspect ratio, basis 0: every photo of the row ends at one height. */}
        {row.map(({ p, i }) => item(p, i, { flexGrow: p.width / p.height }))}
      </div>
    ))
  } else {
    body = photos.map((p, i) => item(p, i, undefined, layout === 'mosaic' && i === 0))
  }

  const gallery = (
    <div
      data-gallery={layout}
      data-columns={cols}
      role="group"
      aria-label={`Galerie de ${count} photos`}
      className={`vh-gallery vh-gallery--${layout}`}
    >
      {body}
    </div>
  )

  return (
    <figure className="vh-gallery-block" data-gallery-block={layout}>
      {lightbox ? <GalleryZoom photos={photos}>{gallery}</GalleryZoom> : gallery}
      {caption?.trim() ? (
        <figcaption className="vh-gallery-block__caption">{typoFr(caption.trim())}</figcaption>
      ) : null}
    </figure>
  )
}
