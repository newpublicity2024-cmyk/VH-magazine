'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState } from 'react'

import { PlayIcon } from '@/components/icons'
import { VideoEmbed } from '@/components/VideoEmbed'

export type TvVideo = {
  id: number
  title: string
  href: string
  date: string
  isoDate: string
  videoUrl: string | null
  image: { url: string; width: number; height: number; alt: string } | null
}

/**
 * VH TV (DESIGN-SPEC-R3 §5.4): a featured 16:9 player above a grid of video cards on
 * black. Pressing a card's play control swaps that video into the featured player in
 * place — no navigation — and starts it; the title still links to the article.
 *
 * The grid keeps one `data-card` per video and the play-triangle path G25 counts.
 */
export function VhTvPlayer({ videos }: { videos: TvVideo[] }) {
  const [current, setCurrent] = useState(0)
  const [started, setStarted] = useState(false)
  const featured = useRef<HTMLElement>(null)
  const v = videos[current]
  if (!v) return null

  const pick = (index: number) => {
    setCurrent(index)
    setStarted(true)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    featured.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <>
      <section
        ref={featured}
        data-vhtv-featured
        aria-label="Vidéo à la une"
        className="mt-8 grid items-end gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12"
      >
        <div key={v.id}>
          {v.videoUrl ? (
            <VideoEmbed url={v.videoUrl} title={v.title} autoPlay={started} />
          ) : v.image ? (
            <div className="vh-edge aspect-video overflow-hidden bg-night-2">
              <Image
                src={v.image.url}
                alt={v.image.alt}
                width={v.image.width}
                height={v.image.height}
                sizes="(min-width: 1024px) 780px, 100vw"
                priority
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
        </div>
        <div>
          <p className="type-kicker text-accent-on-dark">À la une</p>
          <h2 data-vhtv-title className="type-title-lg mt-3 text-white">
            <Link href={v.href} className="vh-hover-line">
              {v.title}
            </Link>
          </h2>
          <time dateTime={v.isoDate} className="type-meta mt-3 block text-night-ink-2">
            {v.date}
          </time>
        </div>
      </section>

      <div data-video-grid className="mt-16 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((x, i) => (
          <article key={x.id} data-card data-variant="video" className="vh-card flex flex-col">
            <button
              type="button"
              data-vhtv-pick
              aria-pressed={i === current}
              aria-label={`Lire ici : ${x.title}`}
              onClick={() => pick(i)}
              className="vh-card-media block aspect-video w-full"
            >
              {x.image ? (
                <Image
                  src={x.image.url}
                  alt=""
                  width={x.image.width}
                  height={x.image.height}
                  sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                  loading="lazy"
                  data-fade
                  className="h-full w-full object-cover"
                />
              ) : null}
              <span aria-hidden="true" className="vh-play">
                <PlayIcon className="ml-1 h-5 w-5" />
              </span>
            </button>
            <div className="pt-3">
              <h3 data-card-title className="type-title vh-clamp-3 text-night-ink">
                <Link href={x.href} className="vh-hover-line">
                  {x.title}
                </Link>
              </h3>
              <time data-date dateTime={x.isoDate} className="type-meta mt-2 block text-night-ink-2">
                {x.date}
              </time>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
