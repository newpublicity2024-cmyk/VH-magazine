import sharp from 'sharp'

/**
 * Generate placeholder imagery locally with sharp — no network, no picsum.
 *
 * This matters for more than convenience: the images are REAL JPEGs with real
 * dimensions, so Payload populates width/height, next/image can genuinely
 * optimize them, and the CLS and AVIF/WebP gates measure something instead of
 * passing against a remote URL that may or may not resolve.
 *
 * The palette is VH's own (near-black through the signature red), so the seeded
 * homepage reads as the brand at a glance rather than as grey boxes — which
 * makes the visual comparison against the wireframe actually useful.
 */

const PALETTE = [
  ['#111111', '#3a3a3a'],
  ['#e31e24', '#7a1013'],
  ['#1c1c22', '#4a4a55'],
  ['#2b2118', '#6b5237'],
  ['#0f1f2e', '#2d4a63'],
  ['#241a24', '#5a3f57'],
]

/** Deterministic per-key colour choice, so re-seeding produces identical bytes. */
function paletteFor(key: string): [string, string] {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length] as [string, string]
}

/** Escape text for safe inclusion in the SVG source. */
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * A diagonal-gradient JPEG carrying a short label, at the requested aspect.
 * `label` is drawn small and low-contrast — it identifies the placeholder
 * without pretending to be a real photograph.
 */
export async function placeholderImage(
  key: string,
  label: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const [from, to] = paletteFor(key)
  const short = label.length > 42 ? `${label.slice(0, 41)}…` : label

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <rect x="0" y="${height - 4}" width="${Math.round(width * 0.28)}" height="4" fill="#e31e24"/>
    <text x="${Math.round(width * 0.06)}" y="${Math.round(height * 0.9)}"
          font-family="Helvetica, Arial, sans-serif" font-size="${Math.max(11, Math.round(width / 32))}"
          fill="#ffffff" fill-opacity="0.72">${esc(short)}</text>
  </svg>`

  return sharp(Buffer.from(svg)).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
}

/** Card / featured image, 16:9 per spec §5.1. */
export const articleImage = (key: string, label: string) =>
  placeholderImage(key, label, 1280, 720)

/** Magazine cover, portrait 3:4 per spec §5.13. */
export const coverImage = (key: string, label: string) => placeholderImage(key, label, 720, 960)

/** Wide promo banner. */
export const bannerImage = (key: string, label: string) => placeholderImage(key, label, 1600, 500)
