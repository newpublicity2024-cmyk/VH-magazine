/**
 * G9 — each homepage block renders exactly the card count spec §5 requires.
 *
 * Counts are taken INSIDE each section's own subtree, so a block that rendered
 * the right total by borrowing cards from its neighbour would still fail.
 */
import {
  homepageHtml,
  assert,
  assertEqual,
  ok,
  sectionHtml,
  widgetHtml,
  countMarkers,
} from './lib/harness.mjs'

/** section key → required card count, straight from spec §5. */
const EXPECTED = {
  actu: 4, // §5.1
  lifestyle: 4, // §5.2
  moteur: 4, // §5.3
  'chroniques-cigare': 5, // §5.6
  videos: 6, // §5.9
  people: 5, // §5.11
  unes: 4, // §5.13
}

/** Sidebar widgets are lists, counted within their own widget subtree. */
const SIDEBAR_EXPECTED = {
  'most-read': 5, // §5.4.5 "Les plus lus"
  'latest-articles': 5, // §5.4.6 "Derniers articles"
}

const html = await homepageHtml()

for (const [key, expected] of Object.entries(EXPECTED)) {
  const body = sectionHtml(html, key)
  assert(body !== null, `section "${key}" not found`)
  const measured = countMarkers(body, 'data-card')
  assertEqual(measured, expected, `card count in section "${key}"`)
}

for (const [key, expected] of Object.entries(SIDEBAR_EXPECTED)) {
  const body = widgetHtml(html, key)
  assert(body !== null, `sidebar widget "${key}" not found (expected data-widget="${key}")`)
  const measured = countMarkers(body, 'data-card')
  assertEqual(measured, expected, `item count in sidebar widget "${key}"`)
}

// Sanity: the totals must add up, so a card rendered outside every section
// (or double-counted by nesting) shows up as a discrepancy rather than passing.
const totalExpected =
  Object.values(EXPECTED).reduce((a, b) => a + b, 0) +
  Object.values(SIDEBAR_EXPECTED).reduce((a, b) => a + b, 0)
const totalMeasured = countMarkers(html, 'data-card')
assertEqual(totalMeasured, totalExpected, 'total data-card count across the homepage')

ok('COUNTS_OK')
