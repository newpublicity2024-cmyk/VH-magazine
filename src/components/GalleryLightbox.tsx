'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'

import { Chevron } from '@/components/GalleryCarousel'
import { CloseIcon } from '@/components/icons'
import type { GalleryPhoto } from '@/lib/gallery'
import { typoFr } from '@/lib/typo-fr'

const SWIPE_MIN_PX = 40

/**
 * The gallery's full-screen view, a native modal `<dialog>`: the browser traps focus, makes the
 * page inert and closes it on Escape. Rendered into `<body>` so the article's prose styles
 * (`.vh-prose img { width: 100% }`) cannot reach it. ← → step through the photos (Home / End
 * jump), a horizontal swipe does the same, a click beside the photo closes. The counter is a live
 * region, so a screen-reader user hears where they are; caption and credit sit under the photo.
 *
 * Default export: GalleryZoom loads it with next/dynamic on the first click.
 */
export default function GalleryLightbox({
  photos,
  start,
  onClose,
}: {
  photos: GalleryPhoto[]
  start: number
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const [index, setIndex] = useState(Math.min(Math.max(start, 0), photos.length - 1))
  const count = photos.length
  const step = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count])

  useEffect(() => {
    const el = dialog.current
    if (el && !el.open) el.showModal()
    const root = document.documentElement
    root.dataset.lightbox = 'open'
    return () => {
      delete root.dataset.lightbox
    }
  }, [])

  const close = () => dialog.current?.close()
  const photo = photos[index]
  if (!photo) return null

  const onPointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    swipe.current = { x: event.clientX, y: event.clientY }
  }
  const onPointerUp = (event: PointerEvent<HTMLDialogElement>) => {
    const from = swipe.current
    swipe.current = null
    if (!from) return
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
      step(dx < 0 ? 1 : -1)
      return
    }
    // A click (not a drag) on the dark area around the photo closes, as on every lightbox.
    const target = event.target as Element
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && target.matches('dialog, .vh-lightbox__stage')) close()
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="vh-lightbox"
      data-lightbox
      data-index={index}
      aria-label={`Photo ${index + 1} sur ${count}`}
      onClose={onClose}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') step(1)
        else if (event.key === 'ArrowLeft') step(-1)
        else if (event.key === 'Home') setIndex(0)
        else if (event.key === 'End') setIndex(count - 1)
        else return
        event.preventDefault()
      }}
    >
      <div className="vh-lightbox__bar">
        <p className="vh-lightbox__count" aria-live="polite" data-lightbox-count>
          {index + 1} / {count}
        </p>
        <button
          type="button"
          className="vh-lightbox__btn"
          data-lightbox-close
          onClick={close}
          aria-label="Fermer la galerie"
          // The first focus inside the dialog: Escape and Enter both close from here.
          autoFocus
        >
          <CloseIcon className="h-6 w-6" />
        </button>
      </div>
      <div className="vh-lightbox__stage">
        {/* key: a fresh <img> per photo, so the previous one never shows while the next decodes. */}
        <Image
          key={index}
          src={photo.url}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          sizes="100vw"
          className="vh-lightbox__img"
          data-lightbox-img={index}
        />
        {count > 1 ? (
          <>
            <button
              type="button"
              className="vh-lightbox__btn vh-lightbox__nav vh-lightbox__nav--prev"
              data-lightbox-prev
              onClick={() => step(-1)}
              aria-label="Photo précédente"
            >
              <Chevron flip />
            </button>
            <button
              type="button"
              className="vh-lightbox__btn vh-lightbox__nav vh-lightbox__nav--next"
              data-lightbox-next
              onClick={() => step(1)}
              aria-label="Photo suivante"
            >
              <Chevron />
            </button>
          </>
        ) : null}
      </div>
      {photo.caption || photo.credit ? (
        <p className="vh-lightbox__caption">
          {photo.caption ? typoFr(photo.caption) : null}
          {photo.credit ? <span className="vh-lightbox__credit">© {photo.credit}</span> : null}
        </p>
      ) : null}
    </dialog>,
    document.body,
  )
}
