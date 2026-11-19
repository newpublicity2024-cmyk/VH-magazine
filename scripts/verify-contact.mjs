/**
 * G26 — the contact form (spec §7) and the honeypot rider.
 *
 * Driven through a real browser rather than by posting to the Server Action
 * endpoint directly. Next 16 encodes action ids inside the RSC payload, so a
 * hand-rolled POST is coupled to framework internals and would break on an
 * upgrade while the form itself still worked. Filling the form is also simply
 * what a visitor does, which is what the gate claims to measure.
 *
 * Negative control: node scripts/verify-contact.mjs --self-test
 */
import { withPage } from './lib/browser.mjs'
import { assert, assertEqual, ok, fail, pgClient } from './lib/harness.mjs'

const SELF_TEST = process.argv.includes('--self-test')
const stamp = Date.now()

const countByEmail = async (email) => {
  const client = await pgClient()
  const { rows } = await client.query('select count(*)::int as n from contact_messages where email = $1', [email])
  await client.end()
  return rows[0].n
}

const cleanup = async () => {
  const client = await pgClient()
  await client.query("delete from contact_messages where email like 'g26-%'")
  await client.end()
}

await cleanup()

const goodEmail = `g26-good-${stamp}@example.com`
const potEmail = `g26-pot-${stamp}@example.com`

try {
  await withPage(async ({ page, baseUrl }) => {
    // Open the form and wait until React has hydrated it (the action runs through React), not
    // for `networkidle`: a navigation that starts while link prefetches are in flight orphans
    // them — Chromium never reports them finished, so `networkidle` never arrives (measured
    // 2026-11-19: five `?_rsc=` prefetches started at 193 ms, the moment the next navigation
    // began, stayed "open" for good while the server answered the same requests in a few ms).
    const openForm = async () => {
      await page.goto(`${baseUrl}/contact/`, { waitUntil: 'load' })
      await page.waitForFunction(() => {
        const f = document.querySelector('[data-contact-form]')
        return Boolean(f) && Object.keys(f).some((k) => k.startsWith('__reactProps'))
      })
    }
    const fill = async ({ name, email, subject, message, honeypot }) => {
      await openForm()
      await page.fill('#vh-name', name)
      await page.fill('#vh-email', email)
      if (subject) await page.fill('#vh-subject', subject)
      await page.fill('#vh-message', message)
      if (honeypot) {
        // A human cannot reach this field; a bot fills it blind.
        await page.evaluate((v) => {
          const el = document.querySelector('input[name="website"]')
          if (el) el.value = v
        }, honeypot)
      }
      await page.click('button[type="submit"]')
      await page.waitForSelector('[data-contact-status]:not(.hidden)', { timeout: 15000 }).catch(() => {})
      return (await page.textContent('[data-contact-status]'))?.trim() ?? ''
    }

    // The honeypot must be present and genuinely hidden from humans.
    await page.goto(`${baseUrl}/contact/`, { waitUntil: 'domcontentloaded' })
    const pot = await page.$('input[name="website"]')
    assert(pot !== null, 'honeypot field is absent from the contact form')

    // `isVisible()` is the wrong oracle here: the field is deliberately rendered
    // off-screen rather than display:none, because bots skip hidden inputs and a
    // trap they skip catches nothing. So assert what actually protects a human —
    // it sits outside the viewport, is skipped by the keyboard, and is hidden
    // from assistive tech.
    const box = await pot.boundingBox()
    const offScreen = !box || box.x + box.width <= 0 || box.y + box.height <= 0 || box.width === 0
    assert(offScreen, `the honeypot is inside the viewport at ${JSON.stringify(box)} — a sighted user could fill it`)
    assertEqual(await pot.getAttribute('tabindex'), '-1', 'honeypot must be out of the tab order')
    const potHiddenAncestor = await pot.evaluate((el) => Boolean(el.closest('[aria-hidden="true"]')))
    assert(potHiddenAncestor, 'honeypot must be inside an aria-hidden container so screen readers skip it')

    // 1. A valid submission stores exactly one row.
    const okMsg = await fill({ name: 'Gate G26', email: goodEmail, subject: 'Test', message: 'Bonjour la rédaction.' })
    assert(/merci/i.test(okMsg), `expected a success message, measured "${okMsg}"`)
    assertEqual(await countByEmail(goodEmail), 1, 'a valid contact submission must store exactly one row')

    // 2. Honeypot filled -> discarded silently, nothing written.
    const potMsg = await fill({ name: 'Bot', email: potEmail, subject: 'spam', message: 'spam', honeypot: 'http://spam.example' })
    const potRows = await countByEmail(potEmail)

    if (SELF_TEST) {
      if (potRows > 0) fail('self-test: the honeypot submission WAS stored — the trap does not work')
      console.error('  self-test: honeypot stored 0 rows; the assertion below would fail if it had')
      return
    }

    assert(/merci/i.test(potMsg), 'a honeypot submission must still LOOK successful to the bot')
    assertEqual(potRows, 0, 'a honeypot-filled submission must be silently discarded, not stored')

    // 3. An invalid email is rejected by the action, not just the browser.
    await openForm()
    await page.evaluate(() => {
      const f = document.querySelector('[data-contact-form]')
      f?.setAttribute('novalidate', 'novalidate')
      const e = document.querySelector('#vh-email')
      if (e) e.setAttribute('type', 'text')
    })
    await page.fill('#vh-name', 'Gate')
    await page.fill('#vh-email', `g26-bad-${stamp}`)
    await page.fill('#vh-message', 'test')
    await page.click('button[type="submit"]')
    await page.waitForSelector('[data-contact-status]:not(.hidden)', { timeout: 15000 }).catch(() => {})
    const badMsg = (await page.textContent('[data-contact-status]'))?.trim() ?? ''
    assert(/valide/i.test(badMsg), `an invalid email must be rejected server-side, measured "${badMsg}"`)
    assertEqual(await countByEmail(`g26-bad-${stamp}`), 0, 'an invalid email must not be stored')

    console.error('  valid stored, honeypot discarded, invalid email rejected')
  })
} finally {
  await cleanup()
}

ok(SELF_TEST ? 'SELF_TEST_OK' : 'CONTACT_OK')
