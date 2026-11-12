'use client'

import Image from 'next/image'
import { useState } from 'react'

import { PlayIcon } from '@/components/icons'
import { videoId } from '@/lib/youtube'

/**
 * Click-to-load YouTube facade (spec §9, DESIGN-SPEC-R3 §4.9): the poster from
 * i.ytimg.com and a 64 px dark-material play circle; the iframe (youtube-nocookie) mounts
 * only on click — or at once when `autoPlay` is set by a player that swaps videos in
 * place (VH TV), since that swap is itself the reader's click.
 */
export function VideoEmbed({ url, title = 'Vidéo', autoPlay = false }: { url: string; title?: string; autoPlay?: boolean }) {
  const [playing, setPlaying] = useState(autoPlay)
  const id = videoId(url)
  if (!id) return null

  if (playing) {
    return (
      <div data-video-embed className="relative aspect-video w-full bg-band">
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
      className="vh-card vh-card-media block aspect-video w-full bg-band"
    >
      <Image
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        width={480}
        height={360}
        loading="lazy"
        data-fade
        className="h-full w-full object-cover"
      />
      <span aria-hidden="true" className="vh-play vh-play-lg">
        <PlayIcon className="ml-1 h-6 w-6" />
      </span>
    </button>
  )
}
