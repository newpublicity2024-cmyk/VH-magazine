/**
 * Let a prerendered page build without a reachable database.
 *
 * Several routes are statically generated with ISR, which means Next executes
 * their data fetching during `next build`. On Vercel that build runs in a
 * container that may have no database configured yet — and a single failed
 * query aborts the whole build with a stack trace that names the route rather
 * than the cause ("Error occurred prerendering page /news-sitemap.xml").
 *
 * This degrades ONLY during the production build phase. At runtime the error is
 * rethrown untouched, because an empty homepage served to a reader is a far
 * worse failure than a 500 — it looks fine and is silently wrong.
 *
 * The prerendered fallback is not permanent: the first revalidation after
 * deploy regenerates the page against the real database.
 */
const isProductionBuild = () => process.env.NEXT_PHASE === 'phase-production-build'

export async function buildSafe<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (!isProductionBuild()) throw error
    console.warn(
      `[build-safe] ${label} could not reach the database during the build; ` +
        `prerendering an empty shell. It will fill in on the first revalidation. ` +
        `(${error instanceof Error ? error.message : String(error)})`,
    )
    return fallback
  }
}
