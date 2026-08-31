'use client'

import { useEffect, useState } from 'react'

import { ArrowUpIcon } from '@/components/icons'

/**
 * Floating "back to top" button (spec §4.3).
 *
 * Hidden until the reader is well down the page, so it never covers content on
 * a short viewport. Respects prefers-reduced-motion by falling back to an
 * instant jump — a smooth scroll across a 14-section homepage is a long
 * animation for someone who asked not to have them.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  const toTop = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Retour en haut de la page"
      className="fixed bottom-6 end-6 z-40 flex h-11 w-11 items-center justify-center bg-ink text-white shadow-lg transition-colors hover:bg-vh-red"
    >
      <ArrowUpIcon className="h-5 w-5" />
    </button>
  )
}
