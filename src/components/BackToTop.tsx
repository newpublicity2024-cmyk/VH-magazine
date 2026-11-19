'use client'

import { useEffect, useState } from 'react'

import { ArrowUpIcon } from '@/components/icons'

/**
 * Back to top (spec §4.3, DESIGN-SPEC-R3 §4.8): a 44 px dark-material circle that fades
 * and rises in after 600 px of scroll. Rendered always and toggled, so it can animate
 * out as well as in; hidden, it is neither visible nor focusable. Respects reduced
 * motion by jumping instead of smooth-scrolling a long page.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      setVisible(window.scrollY > 600)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  const toTop = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      data-back-to-top
      data-visible={visible}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={toTop}
      aria-label="Retour en haut de la page"
      className="vh-back-to-top"
    >
      <ArrowUpIcon className="h-5 w-5" />
    </button>
  )
}
