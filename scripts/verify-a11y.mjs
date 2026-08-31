/**
 * G16 — an axe scan of the homepage reports zero serious or critical violations.
 *
 * Scoped to serious/critical deliberately: axe's "minor" and "moderate" buckets
 * include advisory rules that a faithful magazine rebuild will trip without any
 * real user impact. Every violation at or above serious is reported with its
 * offending selector so the failure is fixable, not just countable.
 */
import { withPage, gotoHome } from './lib/browser.mjs'
import { assert, ok, fail } from './lib/harness.mjs'

let AxeBuilder
try {
  ;({ default: AxeBuilder } = await import('@axe-core/playwright'))
} catch {
  fail('@axe-core/playwright is not installed. Run `pnpm install`.')
}

const BLOCKING = new Set(['serious', 'critical'])

await withPage(async ({ page, baseUrl, pageErrors }) => {
  await gotoHome(page, baseUrl)
  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const blocking = results.violations.filter((v) => BLOCKING.has(v.impact))

  if (blocking.length > 0) {
    for (const v of blocking) {
      console.error(`  [${v.impact}] ${v.id}: ${v.help}`)
      for (const node of v.nodes.slice(0, 3)) {
        console.error(`      ${node.target.join(' ')}`)
      }
    }
  }

  assert(
    blocking.length === 0,
    `${blocking.length} serious/critical axe violation(s): ${blocking.map((v) => v.id).join(', ')}`,
  )

  // Vacuity guard: axe returning nothing at all usually means it failed to
  // inject rather than that the page is perfect.
  const checked = results.passes.length + results.violations.length + results.incomplete.length
  assert(
    checked > 20,
    `axe evaluated only ${checked} rules — it probably failed to inject rather than finding a clean page`,
  )

  console.error(
    `  axe: ${results.passes.length} passes, ${results.violations.length} violations ` +
      `(${blocking.length} serious/critical)`,
  )
}, { viewport: { width: 1440, height: 900 } })

ok('A11Y_OK')
