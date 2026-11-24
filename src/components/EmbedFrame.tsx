'use client'

import { useEffect, useRef, useState } from 'react'

import { reportedHeight, type EmbedProvider } from '@/lib/embeds'

/**
 * A provider's player frame, lazy: the browser fetches it only as the reader nears it.
 *
 * Instagram and X draw a card whose height depends on the post, and say so through
 * `postMessage` (lib/embeds `reportedHeight`). For those, the server HTML carries the address in
 * `data-src` only, and the effect sets `src` on the element after attaching its listener, so the
 * listener exists before the frame can speak — a height sent before hydration would be lost and
 * the card cut off. Messages count only from the provider's
 * origin AND this frame's own window, so two posts on one page never resize each other.
 * Fixed-shape players (16:9, 9:16) keep their address in the server HTML.
 */
export function EmbedFrame({
  src,
  title,
  provider,
  heightOrigin,
  initialHeight,
}: {
  src: string
  title: string
  provider: EmbedProvider
  heightOrigin: string | null
  initialHeight: number
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(initialHeight)

  useEffect(() => {
    if (!heightOrigin) return
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== heightOrigin || event.source !== frame.current?.contentWindow) return
      const next = reportedHeight(provider, event.data)
      if (next) setHeight(next)
    }
    window.addEventListener('message', onMessage)
    // React leaves an attribute alone while its prop stays undefined, so this sticks.
    if (frame.current && !frame.current.getAttribute('src')) frame.current.src = src
    return () => window.removeEventListener('message', onMessage)
  }, [heightOrigin, provider, src])

  const sized = initialHeight > 0
  return (
    <iframe
      ref={frame}
      src={heightOrigin ? undefined : src}
      data-src={src}
      data-embed-frame={provider}
      data-height={sized ? height : undefined}
      title={title}
      loading="lazy"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write; web-share"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      style={sized ? { height } : undefined}
    />
  )
}
