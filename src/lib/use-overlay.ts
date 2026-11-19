'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Modal-surface behaviour shared by the mobile drawer and the search panel (spec §4.3,
 * §4.4, §7). The surface is rendered always and toggled with `inert` + `data-state`, so
 * it can animate both ways and stays in the server HTML; this hook supplies the rest:
 * Escape closes, Tab and Shift+Tab cycle inside the surface, the page behind does not
 * scroll, focus moves in on open (to `initialFocus` or the surface) and returns to the
 * trigger on close.
 */
export function useOverlay<T extends HTMLElement>(initialFocus?: RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false)
  const surfaceRef = useRef<T>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const surface = surfaceRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ;(initialFocus?.current ?? surface)?.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !surface) return
      const items = [...surface.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.getClientRects().length > 0,
      )
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const inside = surface.contains(active)
      if (event.shiftKey && (active === first || active === surface || !inside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, initialFocus])

  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus({ preventScroll: true })
    wasOpen.current = open
  }, [open])

  return { open, setOpen, close, surfaceRef, triggerRef }
}
