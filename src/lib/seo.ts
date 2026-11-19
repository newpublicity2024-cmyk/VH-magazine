import type { Metadata } from 'next'

import { SITE } from '@/lib/site'
import { withTrailingSlash } from '@/lib/routes'

/**
 * Canonical origin for every absolute URL. Normalised to have NO trailing
 * slash, so `absoluteUrl` can add exactly one and never produce `//`.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SERVER_URL || 'https://vh.ma').replace(/\/+$/, '')

/**
 * Make a path absolute against SITE_URL, in the exact trailing-slash form the
 * route actually serves.
 *
 * Amendment A4: `trailingSlash: true` means Next serves `/moteur/x/`, so a
 * canonical of `/moteur/x` would point at a URL that 308-redirects — telling
 * crawlers the canonical is a redirect. Routing every canonical through
 * `withTrailingSlash` (the same helper the link builders use) makes it
 * structurally impossible for the served URL and the canonical to disagree.
 */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${withTrailingSlash(path)}`
}

/**
 * Make a FILE's URL absolute — an image, a logo, a media upload — never adding a slash.
 *
 * `absoluteUrl` is for pages: it appends the trailing slash `trailingSlash: true` serves.
 * On a file that produced `/vh-logo.svg/` and `/api/media/file/x.jpg/`, which Next answers
 * with a 308 that strips the slash, so JSON-LD pointed at redirects (gate GATES-LAUNCH L5).
 * Blob media URLs are already absolute and pass through untouched.
 */
export function absoluteFileUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `${SITE_URL}/${url.replace(/^\/+/, '')}`
}

type MediaLike = { url?: string | null; width?: number | null; height?: number | null } | null

/** Absolute OG image URL, falling back to the site default. */
export function ogImageUrl(image: MediaLike, fallback?: MediaLike): string | undefined {
  const media = image?.url ? image : (fallback ?? null)
  if (!media?.url) return undefined
  return absoluteFileUrl(media.url)
}

type BuildMetaArgs = {
  title: string
  description?: string | null
  /** Canonical path, e.g. `/moteur/vh-moteur/porsche-licone-sous-pression/`. */
  path: string
  /** Already-resolved absolute OG image URL (from ogImageUrl). */
  image?: string
  type?: 'website' | 'article'
  publishedTime?: string | null
  modifiedTime?: string | null
  section?: string | null
  noIndex?: boolean
  /** Explicit override from the document's seo.canonicalURL field. */
  canonicalOverride?: string | null
}

/**
 * Build a Next Metadata object with a self-referencing canonical, OpenGraph and
 * Twitter card. Spec §9 fixes the title pattern and the twitter handle.
 */
export function buildMetadata(args: BuildMetaArgs): Metadata {
  const {
    title,
    description,
    path,
    image,
    type = 'website',
    publishedTime,
    modifiedTime,
    section,
    noIndex,
    canonicalOverride,
  } = args

  const canonical = canonicalOverride ? absoluteUrl(canonicalOverride) : absoluteUrl(path)
  const images = image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined

  return {
    title,
    description: description ?? undefined,
    alternates: { canonical },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, 'max-image-preview': 'large' },
    openGraph: {
      type,
      url: canonical,
      title,
      description: description ?? undefined,
      siteName: SITE.name,
      locale: SITE.locale,
      images,
      ...(type === 'article'
        ? {
            publishedTime: publishedTime ?? undefined,
            modifiedTime: modifiedTime ?? undefined,
            section: section ?? undefined,
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      site: SITE.twitterHandle,
      title,
      description: description ?? undefined,
      images: image ? [image] : undefined,
    },
  }
}
