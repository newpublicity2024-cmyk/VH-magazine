/**
 * G14 — image hygiene (spec §9): no image without explicit dimensions, featured
 * images served through the Next optimizer, first Actu card marked priority.
 *
 * "No image without width/height" is a negative assertion, so it is only worth
 * anything if it can fail:  node scripts/verify-images.mjs --self-test
 */
import {
  homepageHtml,
  withServer,
  assert,
  assertEqual,
  ok,
  fail,
  sectionHtml,
} from './lib/harness.mjs'

const MIN_IMAGES = 25 // one per card at minimum; guards against a vacuous pass.

/** Every <img> tag in the document. */
function imgTags(html) {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0])
}

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag)
  return m ? m[1] : null
}

function checkDimensions(html, { requireMinimum = true } = {}) {
  const tags = imgTags(html)

  if (requireMinimum) {
    assert(
      tags.length >= MIN_IMAGES,
      `only ${tags.length} <img> tags rendered — expected at least ${MIN_IMAGES}. ` +
        'A page with no images would satisfy "none missing dimensions" vacuously.',
    )
  }

  // An explicit width/height pair is what kills CLS. `fill` images are the
  // documented exception: they size from a positioned parent, so they legitimately
  // carry no intrinsic dimensions.
  const missing = tags.filter((t) => {
    const isFill = /\bstyle="[^"]*position:\s*absolute/i.test(t) || attr(t, 'data-fill') !== null
    if (isFill) return false
    return attr(t, 'width') === null || attr(t, 'height') === null
  })

  assert(
    missing.length === 0,
    `${missing.length} <img> without explicit width/height (CLS risk): ${JSON.stringify(
      missing.slice(0, 3).map((t) => t.slice(0, 160)),
    )}`,
  )
  return tags
}

if (process.argv.includes('--self-test')) {
  const good = Array.from(
    { length: MIN_IMAGES },
    (_, i) => `<img src="/_next/image?url=%2Fa${i}.jpg&w=640&q=75" width="640" height="360" alt="x">`,
  ).join('')
  // Control: strip the dimensions off one image; the checker must reject it.
  const broken = good + '<img src="/_next/image?url=%2Fbad.jpg&w=640&q=75" alt="no dims">'
  checkDimensions(broken)
  fail('self-test: the checker ACCEPTED an <img> with no width/height. Oracle is broken.')
}

const html = await homepageHtml()
const tags = checkDimensions(html)

// Featured images must go through the Next optimizer (spec §9: AVIF/WebP).
// Inline SVG logos and data: URIs are legitimately not optimized.
const raster = tags.filter((t) => {
  const src = attr(t, 'src') || ''
  return !src.startsWith('data:') && !src.endsWith('.svg')
})
assert(raster.length > 0, 'no raster images on the homepage')

// `trailingSlash: true` makes Next emit `/_next/image/?url=…` — note the slash
// before the query string — and the attribute is HTML-escaped (&amp;).
const unoptimized = raster.filter((t) => !/^\/_next\/image\/?\?/.test(attr(t, 'src') || ''))
assert(
  unoptimized.length === 0,
  `${unoptimized.length} raster image(s) bypass /_next/image: ${JSON.stringify(
    unoptimized.slice(0, 3).map((t) => attr(t, 'src')),
  )}`,
)

// Pattern-matching the src proves only that Next wrote a URL. Fetch one and
// confirm the optimizer actually answers it in a modern format — this is also
// the check that would catch `trailingSlash: true` breaking the /_next/image
// route, which is exactly the kind of failure a source-only gate would miss.
const sampleSrc = (attr(raster[0], 'src') || '').replace(/&amp;/g, '&')
await withServer(async (baseUrl) => {
  const res = await fetch(`${baseUrl}${sampleSrc}`, {
    headers: { accept: 'image/avif,image/webp,image/*,*/*' },
  })
  assertEqual(res.status, 200, `GET ${sampleSrc} status (the image optimizer must answer)`)
  const type = res.headers.get('content-type') || ''
  assert(
    /^image\/(avif|webp)$/.test(type),
    `optimizer returned "${type}" for ${sampleSrc} — spec §9 requires AVIF/WebP`,
  )
  const bytes = (await res.arrayBuffer()).byteLength
  assert(bytes > 500, `optimized image is only ${bytes} bytes — likely an error placeholder`)
  console.error(`  optimizer: ${type}, ${bytes} bytes`)
})

// The first Actu card is the LCP candidate: spec §9 wants it eager + priority.
const actu = sectionHtml(html, 'actu')
assert(actu !== null, 'actu section not found')
const actuImgs = imgTags(actu)
assert(actuImgs.length > 0, 'no images in the actu section')

const firstActu = actuImgs[0]
assertEqual(attr(firstActu, 'loading'), null, 'first Actu image loading attribute (priority images must not be lazy)')
assert(
  attr(firstActu, 'fetchpriority') === 'high',
  `first Actu image is not fetchpriority="high" — measured ${JSON.stringify(
    attr(firstActu, 'fetchpriority'),
  )}. Spec §9 asks for priority on the first Actu card.`,
)

// Everything below the fold should be lazy, or the priority hint means nothing.
const lazyCount = tags.filter((t) => attr(t, 'loading') === 'lazy').length
assert(
  lazyCount >= tags.length - 3,
  `only ${lazyCount}/${tags.length} images are lazy-loaded — spec §9 wants below-the-fold images lazy`,
)

// Alt text on every image (a11y, and G16 would catch it later anyway).
const noAlt = tags.filter((t) => attr(t, 'alt') === null)
assert(noAlt.length === 0, `${noAlt.length} <img> without an alt attribute`)

ok('IMAGES_OK')
