/**
 * The « Galerie photos » block's rules, shared by the public renderer (components/Gallery) and
 * the gates. Pure: no React, no Next.
 */
import type { GalleryLayout } from '../blocks/Gallery'

export type { GalleryLayout }

export type GalleryPhoto = {
  url: string
  alt: string
  width: number
  height: number
  caption: string | null
  credit: string | null
}

const LAYOUTS: readonly GalleryLayout[] = ['grid', 'mosaic', 'masonry', 'row', 'stack', 'carousel']

/** A stored layout value, or the grid for anything else (a renamed or hand-edited value). */
export function galleryLayout(value: unknown): GalleryLayout {
  return LAYOUTS.includes(value as GalleryLayout) ? (value as GalleryLayout) : 'grid'
}

/**
 * Columns on a wide screen (for `row`, photos per row). A chosen 2–4 is honoured up to the
 * number of photos — three photos never sit in four columns with a hole. « Automatique »: 2 for
 * two or four photos (a square block), 3 otherwise, 1 for a single photo. The mosaic keeps its
 * own rule: three columns under the lead photo from five photos up.
 */
export function galleryColumns(layout: GalleryLayout, requested: unknown, count: number): number {
  if (count <= 1) return 1
  if (layout === 'mosaic') return count >= 5 ? 3 : 2
  if (layout === 'stack' || layout === 'carousel') return 1
  const asked = Number(requested)
  if (Number.isInteger(asked) && asked >= 2 && asked <= 4) return Math.min(asked, count)
  return count === 2 || count === 4 ? 2 : 3
}

/**
 * Photos split into rows of at most `perRow`, as evenly as possible: seven photos in rows of
 * three make 3 + 2 + 2, never 3 + 3 + 1 — a lone photo in the last row would be full width.
 */
export function balancedRows<T>(items: T[], perRow: number): T[][] {
  if (!items.length) return []
  const rows = Math.ceil(items.length / Math.max(1, perRow))
  const base = Math.floor(items.length / rows)
  const extra = items.length % rows
  const out: T[][] = []
  let at = 0
  for (let r = 0; r < rows; r += 1) {
    const size = base + (r < extra ? 1 : 0)
    out.push(items.slice(at, at + size))
    at += size
  }
  return out
}

type MediaDoc = {
  url?: string
  alt?: string
  width?: number
  height?: number
  credit?: string | null
}

/** A gallery block's rows, keeping only photos whose media document was populated. */
export function galleryPhotos(fields: Record<string, unknown>): GalleryPhoto[] {
  const rows = Array.isArray(fields.images) ? (fields.images as Array<Record<string, unknown>>) : []
  const photos: GalleryPhoto[] = []
  for (const row of rows) {
    const media = row?.image as MediaDoc | number | string | null | undefined
    if (!media || typeof media !== 'object' || !media.url) continue
    const caption = typeof row.caption === 'string' && row.caption.trim() ? row.caption.trim() : null
    photos.push({
      url: media.url,
      alt: media.alt || caption || '',
      width: media.width || 1280,
      height: media.height || 960,
      caption,
      credit: typeof media.credit === 'string' && media.credit.trim() ? media.credit.trim() : null,
    })
  }
  return photos
}
