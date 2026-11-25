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
 *
 * The side panel's Chroniques cigare reuses it as vh.ma's sidebar slider: `loop` wraps the ends,
 * and `autoplay` (ms) advances on its own — never under reduced motion, and paused while the
 * pointer or focus is on it, while it is off screen and while the tab is hidden.
 */
export function GalleryCarousel({
  count,
  label,
  children,
  autoplay,
  loop = false,
  itemName = 'photo',
}: {
  count: number
  label: string
  children: ReactNode
  autoplay?: number
  loop?: boolean
  /** Names one slide in the controls' labels: « Photo précédente », « Chronique suivante ». */
  itemName?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const Item = itemName.charAt(0).toUpperCase() + itemName.slice(1)

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
      const next = loop ? (to + count) % count : Math.max(0, Math.min(count - 1, to))
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollTo({ left: next * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
      setIndex(next)
    },
    [count, loop],
  )

  useEffect(() => {
    const el = track.current
    const box = root.current
    if (!autoplay || count < 2 || !el || !box) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let hovered = false
    let focused = false
    let onScreen = true
    const listeners: [string, () => void][] = [
      ['pointerenter', () => (hovered = true)],
      ['pointerleave', () => (hovered = false)],
      ['focusin', () => (focused = true)],
      ['focusout', () => (focused = false)],
    ]
    for (const [type, fn] of listeners) box.addEventListener(type, fn)
    const seen = new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting))
    seen.observe(box)
    const timer = window.setInterval(() => {
      if (hovered || focused || !onScreen || document.hidden) return
      const at = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
      el.scrollTo({ left: ((at + 1) % count) * el.clientWidth, behavior: 'smooth' })
    }, autoplay)
    return () => {
      window.clearInterval(timer)
      seen.disconnect()
      for (const [type, fn] of listeners) box.removeEventListener(type, fn)
    }
  }, [autoplay, count])

  return (
    <div
      ref={root}
      className="vh-carousel"
      data-carousel
      data-autoplay={autoplay || undefined}
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
        aria-label={`${label} — flèches gauche et droite pour changer de ${itemName}`}
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
          disabled={!loop && index <= 0}
          aria-label={`${Item} précédente`}
        >
          <Chevron flip />
        </button>
        {/* An autoplaying count would announce every turn: polite only when the reader moves it. */}
        <p
          className="vh-carousel__count"
          data-carousel-count
          aria-live={autoplay ? 'off' : 'polite'}
        >
          {index + 1} / {count}
        </p>
        <button
          type="button"
          className="vh-carousel__btn"
          data-carousel-next
          onClick={() => go(index + 1)}
          disabled={!loop && index >= count - 1}
          aria-label={`${Item} suivante`}
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
