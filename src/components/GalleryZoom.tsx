'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef, useState, type MouseEvent, type ReactNode } from 'react'

import type { GalleryPhoto } from '@/lib/gallery'

// The lightbox's code is fetched on the first click, not with the article: most readers never
// open one, and article JS is budgeted (GATES.md R3-G10).
const GalleryLightbox = dynamic(() => import('@/components/GalleryLightbox'), { ssr: false })

/**
 * « Agrandir au clic »: wraps a server-rendered gallery and opens the lightbox on the photo whose
 * button (`data-zoom="<index>"`) was pressed — one delegated listener instead of a client
 * component per photo. When the lightbox closes, focus goes back to that button.
 */
export function GalleryZoom({ photos, children }: { photos: GalleryPhoto[]; children: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  const onClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-zoom]')
    if (!button || !event.currentTarget.contains(button)) return
    opener.current = button
    setOpen(Number(button.dataset.zoom) || 0)
  }, [])

  const close = useCallback(() => {
    setOpen(null)
    opener.current?.focus()
  }, [])

  return (
    // Clicks arrive from the photo buttons inside (keyboard included: Enter/Space click a button).
    <div className="vh-gallery-zoom" onClick={onClick}>
      {children}
      {open !== null ? <GalleryLightbox photos={photos} start={open} onClose={close} /> : null}
    </div>
  )
}
