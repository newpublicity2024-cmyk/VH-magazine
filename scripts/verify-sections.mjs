/**
 * G8 — all 14 spec §5 sections are present on the homepage, in spec order.
 *
 * Order is checked by comparing first-occurrence indices in the HTML, which is
 * document order. Presence alone would not catch a homepage that renders every
 * block but stacks People above Vidéos.
 *
 * Amendment A2 is enforced here too: the four blocks the wireframe drew as
 * side-by-side pairs must each be their own top-level section, not two halves
 * of a shared grid row.
 */
import { homepageHtml, assert, ok, sectionHtml } from './lib/harness.mjs'

/** Exactly the 14 sections of spec §5, in spec order. */
const SECTIONS = [
  'actu',
  'lifestyle',
  'moteur',
  'sidebar',
  'whos-who',
  'chroniques-cigare',
  'collector',
  'cool-drives',
  'videos',
  'magazine-banner',
  'people',
  'dossiers',
  'unes',
  'footer',
]

const html = await homepageHtml()

// Presence.
const positions = new Map()
for (const key of SECTIONS) {
  const marker = `data-section="${key}"`
  const at = html.indexOf(marker)
  assert(at !== -1, `section "${key}" is missing from the homepage`)
  positions.set(key, at)

  // A marker with no body would satisfy an index check while rendering nothing.
  const body = sectionHtml(html, key)
  assert(
    body !== null && body.trim().length > 0,
    `section "${key}" is present but renders an empty body`,
  )
}

// Exactly one of each — a duplicated marker makes the order check meaningless.
for (const key of SECTIONS) {
  const count = html.split(`data-section="${key}"`).length - 1
  assert(count === 1, `section "${key}" appears ${count} times, expected exactly 1`)
}

// No unexpected sections: a stray marker would mean the page and this gate
// disagree about what the homepage contains.
const allMarkers = [...html.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1])
const unexpected = allMarkers.filter((k) => !SECTIONS.includes(k))
assert(unexpected.length === 0, `unexpected data-section values: ${unexpected.join(', ')}`)

// Order.
for (let i = 1; i < SECTIONS.length; i += 1) {
  const prev = SECTIONS[i - 1]
  const curr = SECTIONS[i]
  assert(
    positions.get(prev) < positions.get(curr),
    `section order — "${prev}" must precede "${curr}", measured at ${positions.get(
      prev,
    )} and ${positions.get(curr)}`,
  )
}

// Amendment A2: these four are full-width stacked sections, never paired.
// Each must be a sibling <section>, so neither may contain another.
for (const [outer, inner] of [
  ['collector', 'cool-drives'],
  ['dossiers', 'collector'],
]) {
  const body = sectionHtml(html, outer)
  assert(
    body !== null && !body.includes(`data-section="${inner}"`),
    `amendment A2 — "${inner}" is nested inside "${outer}"; they must be sibling full-width sections`,
  )
}

ok('SECTIONS_OK')
