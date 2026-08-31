/**
 * G10 — every date rendered on the homepage is DD/MM/YYYY (spec §3), with none
 * in any other format.
 *
 * This is a negative assertion ("none in any other format"), so it is only worth
 * anything if it can fail. Run it against a fixture with one malformed date and
 * confirm it exits non-zero before trusting a pass:
 *
 *   node scripts/verify-dates.mjs --self-test
 *
 * The vacuity guard below matters just as much: a homepage that rendered no
 * dates at all would satisfy "zero non-matching" trivially.
 */
import { homepageHtml, assert, assertEqual, ok, fail } from './lib/harness.mjs'

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/
const MIN_DATES = 20 // 4+4+4+6+5+5+5 cards carry a date; well under the real total.

/** Pull the text of every <time data-date> element. */
function renderedDates(html) {
  return [...html.matchAll(/<time[^>]*\sdata-date[^>]*>([^<]*)<\/time>/g)].map((m) => m[1].trim())
}

/** Pull the machine-readable dateTime attribute of the same elements. */
function machineDates(html) {
  return [...html.matchAll(/<time[^>]*\sdata-date[^>]*\sdatetime="([^"]*)"/gi)].map((m) => m[1])
}

function check(html, { requireMinimum = true } = {}) {
  const dates = renderedDates(html)

  if (requireMinimum) {
    assert(
      dates.length >= MIN_DATES,
      `only ${dates.length} dates rendered — expected at least ${MIN_DATES}. ` +
        'A page with no dates would pass the format check vacuously.',
    )
  }

  const bad = dates.filter((d) => !DATE_RE.test(d))
  assert(
    bad.length === 0,
    `${bad.length} date(s) not in DD/MM/YYYY: ${JSON.stringify(bad.slice(0, 5))}`,
  )

  // A human-readable date with no machine-readable counterpart is invisible to
  // crawlers, which is half the point of rendering <time> at all.
  const machine = machineDates(html)
  assertEqual(machine.length, dates.length, 'number of <time> elements carrying a datetime attribute')
  const badMachine = machine.filter((d) => !/^\d{4}-\d{2}-\d{2}/.test(d))
  assert(
    badMachine.length === 0,
    `${badMachine.length} datetime attribute(s) not ISO-8601: ${JSON.stringify(badMachine.slice(0, 5))}`,
  )
}

if (process.argv.includes('--self-test')) {
  // Negative control: one malformed date among otherwise valid ones must fail.
  const fixture =
    Array.from(
      { length: MIN_DATES },
      () => '<time data-date datetime="2026-08-22">22/08/2026</time>',
    ).join('') + '<time data-date datetime="2026-08-22">22-08-2026</time>'
  try {
    check(fixture)
  } catch {
    /* assert() exits rather than throwing; see below */
  }
  // check() calls process.exit(1) on failure, so reaching here means it passed
  // the broken fixture — the checker cannot fail and must not be trusted.
  fail('self-test: the checker ACCEPTED a malformed date (22-08-2026). Oracle is broken.')
}

const html = await homepageHtml()
check(html)
ok('DATES_OK')
