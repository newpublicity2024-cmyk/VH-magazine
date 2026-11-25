/**
 * G8 — the homepage's sections are present in vh.ma's order (spec §5 as amended 2026-11-25).
 *
 * Order is checked by comparing first-occurrence indices in the HTML, which is
 * document order. Presence alone would not catch a homepage that renders every
 * block but stacks People above Vidéos.
 *
 * 2026-11-25 (user): Who's Who (Le Club VH), Chroniques cigare, the collector and Cool Drives
 * moved into the side panel, as on vh.ma — they are panel widgets now (data-widget, gate
 * GATES-SIDEBAR SB2/SB3), so the strict allowlist below rejects any section of theirs left
 * behind. Amendment A2 still holds for the full-width blocks that remain: each is its own
 * top-level section, never nested in another.
 */
import { homepageHtml, assert, ok, sectionHtml } from './lib/harness.mjs'

/** Exactly the homepage's sections, in order. */
const SECTIONS = [
  'actu',
  'lifestyle',
  'moteur',
  'sidebar',
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

// Amendment A2: the full-width blocks are stacked sibling sections, never paired.
// Each must be a sibling <section>, so neither may contain another.
for (const [outer, inner] of [
  ['magazine-banner', 'people'],
  ['dossiers', 'unes'],
]) {
  const body = sectionHtml(html, outer)
  assert(
    body !== null && !body.includes(`data-section="${inner}"`),
    `amendment A2 — "${inner}" is nested inside "${outer}"; they must be sibling full-width sections`,
  )
}

ok('SECTIONS_OK')
