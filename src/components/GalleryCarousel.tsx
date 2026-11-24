'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * The « Diaporama » gallery layout: one photo at a time.
 *
 * The track is a native horizontal scroller with scroll-snap, so swiping works on a phone even
 * before this code hydrates. The script adds the arrows, the counter and the keyboard (← → on the
 * focused track) and keeps the counter in step with however the reader moved — button, key or
 * swipe — by reading the scroll position. Smooth scrolling unless the reader asked for reduced
 * motion.
 */
export function GalleryCarousel({
  count,
  label,
  children,
}: {
  count: number
  label: string
  children: ReactNode
}) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const el = track.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() =>
        setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))),
      )
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  const go = useCallback(
    (to: number) => {
      const el = track.current
      if (!el) return
      const next = Math.max(0, Math.min(count - 1, to))
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollTo({ left: next * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
      setIndex(next)
    },
    [count],
  )

  return (
    <div
      className="vh-carousel"
      data-carousel
      role="region"
      aria-roledescription="carrousel"
      aria-label={label}
    >
      <div
        ref={track}
        className="vh-carousel__track"
        data-carousel-track
        tabIndex={0}
        // A name on a plain div is prohibited ARIA (axe: aria-prohibited-attr); a group may carry one.
        role="group"
        aria-label={`${label} — flèches gauche et droite pour changer de photo`}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            go(index + 1)
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            go(index - 1)
          }
        }}
      >
        {children}
      </div>
      <div className="vh-carousel__bar">
        <button
          type="button"
          className="vh-carousel__btn"
          data-carousel-prev
          onClick={() => go(index - 1)}
          disabled={index <= 0}
          aria-label="Photo précédente"
        >
          <Chevron flip />
        </button>
        <p className="vh-carousel__count" data-carousel-count aria-live="polite">
          {index + 1} / {count}
        </p>
        <button
          type="button"
          className="vh-carousel__btn"
          data-carousel-next
          onClick={() => go(index + 1)}
          disabled={index >= count - 1}
          aria-label="Photo suivante"
        >
          <Chevron />
        </button>
      </div>
    </div>
  )
}

export function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      className={flip ? 'vh-chevron-flip' : undefined}
    >
      <path
        d="M9 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
