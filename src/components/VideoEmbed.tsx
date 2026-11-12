'use client'

import Image from 'next/image'
import { useState } from 'react'

import { videoId } from '@/lib/youtube'

/**
 * Click-to-load YouTube facade (spec §9: "Replace Instagram/YouTube heavy
 * embeds with lite facades").
 *
 * A YouTube iframe pulls ~1MB of script and sets cookies on page load, whether
 * or not anyone plays the video. This renders the poster image from
 * i.ytimg.com and only mounts the iframe on click, with `youtube-nocookie` so
 * the reader is not tracked before consenting to watch.
 */
export function VideoEmbed({ url, title = 'Vidéo' }: { url: string; title?: string }) {
  const [playing, setPlaying] = useState(false)
  const id = videoId(url)
  if (!id) return null

  if (playing) {
    return (
      <div data-video-embed className="relative aspect-video w-full">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      data-video-facade
      onClick={() => setPlaying(true)}
      aria-label={`Lire la vidéo : ${title}`}
      className="group relative block aspect-video w-full overflow-hidden"
    >
      <Image
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        width={480}
        height={360}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 transition-colors group-hover:bg-vh-red">
          <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-white" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  )
}
