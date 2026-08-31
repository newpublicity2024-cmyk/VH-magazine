/**
 * G13 — the newsletter form stores a subscriber, and resubmitting the same
 * address neither errors nor creates a duplicate (spec §5.4.3).
 *
 * Driven through a real browser rather than by calling the underlying function:
 * the requirement is that *the form* works, which covers the server action
 * wiring, the pending state and the success message — none of which a direct
 * function call would exercise.
 *
 * The DB is the oracle for the row count. The UI is the oracle for the states.
 * Cleans up after itself so repeated runs stay meaningful.
 */
import { withPage, gotoHome } from './lib/browser.mjs'
import { pgClient, assert, assertEqual, ok } from './lib/harness.mjs'

// Fixed address so a crashed run cannot leave unbounded junk in the table.
const TEST_EMAIL = 'gate-g13@vh-magazine.test'

const client = await pgClient()
await client.query('delete from newsletter_subscribers where email = $1', [TEST_EMAIL])

const countRows = async () => {
  const { rows } = await client.query(
    'select count(*)::int as n from newsletter_subscribers where email = $1',
    [TEST_EMAIL],
  )
  return rows[0].n
}

assertEqual(await countRows(), 0, 'subscriber rows before the test (cleanup failed)')

async function submit(page, baseUrl, { expectLabel }) {
  await gotoHome(page, baseUrl)

  const form = page.locator('[data-newsletter-form]')
  assert((await form.count()) > 0, 'no [data-newsletter-form] on the homepage')

  const input = form.locator('input[type="email"]')
  assert((await input.count()) > 0, 'newsletter form has no email input')

  await input.first().fill(TEST_EMAIL)
  await form.locator('button[type="submit"]').first().click()

  // Wait for the form to report an outcome rather than sleeping a fixed time.
  const status = form.locator('[data-newsletter-status]')
  await status.first().waitFor({ state: 'visible', timeout: 15_000 })
  const text = (await status.first().innerText()).replace(/\s+/g, ' ').trim()

  assert(
    text.length > 0,
    `newsletter status region is visible but empty after ${expectLabel} submission`,
  )
  return text
}

await withPage(async ({ page, baseUrl, pageErrors }) => {
  // First submission — must store the row and confirm to the reader.
  const first = await submit(page, baseUrl, { expectLabel: 'first' })
  assert(
    /merci/i.test(first),
    `first submission did not show the success message (spec §5.4.3 "Merci pour votre inscription!"). Measured: "${first}"`,
  )
  assertEqual(await countRows(), 1, 'subscriber rows after the first submission')

  // Second submission of the SAME address — idempotent, and not an error.
  const second = await submit(page, baseUrl, { expectLabel: 'second' })
  assert(
    !/erreur|error|échec/i.test(second),
    `resubmitting the same address surfaced an error to the reader: "${second}"`,
  )
  assertEqual(await countRows(), 1, 'subscriber rows after resubmitting the same address')

  assert(pageErrors.length === 0, `page errors during submission: ${pageErrors.slice(0, 3).join(' | ')}`)

  console.error(`  first: "${first}" | second: "${second}"`)
})

// The stored row must carry its provenance, or "where did this address come
// from" becomes unanswerable the first time someone asks.
const { rows } = await client.query(
  'select email, source, confirmed from newsletter_subscribers where email = $1',
  [TEST_EMAIL],
)
assertEqual(rows.length, 1, 'stored subscriber rows')
assert(
  typeof rows[0].source === 'string' && rows[0].source.length > 0,
  `stored subscriber has no source — measured ${JSON.stringify(rows[0].source)}`,
)

await client.query('delete from newsletter_subscribers where email = $1', [TEST_EMAIL])
await client.end()
ok('NEWSLETTER_OK')
