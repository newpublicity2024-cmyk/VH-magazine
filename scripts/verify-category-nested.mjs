/**
 * G23 — nested category resolution (amendment A1).
 *
 * The child lists only its own articles; the parent rolls the child's in. That
 * rollup is what makes the Porsche article visible in the Moteur block on the
 * homepage while living at /moteur/vh-moteur/.
 */
import { withServer, getHtml, stripScripts, assert, assertEqual, ok } from './lib/harness.mjs'

const PARENT = '/category/moteur/'
const CHILD = '/category/moteur/vh-moteur/'
const NESTED_ARTICLE = '/moteur/vh-moteur/porsche-licone-sous-pression/'

await withServer(async (baseUrl) => {
  const child = await getHtml(`${baseUrl}${CHILD}`)
  assertEqual(child.status, 200, `nested category ${CHILD} status`)
  const childHtml = stripScripts(child.html)

  assert(
    childHtml.includes(`href="${NESTED_ARTICLE}"`),
    `the child category does not link its own article ${NESTED_ARTICLE}`,
  )

  const parent = await getHtml(`${baseUrl}${PARENT}`)
  assertEqual(parent.status, 200, `parent category ${PARENT} status`)
  const parentHtml = stripScripts(parent.html)

  assert(
    parentHtml.includes(`href="${NESTED_ARTICLE}"`),
    'the parent category does not roll up its subcategory articles',
  )

  // The child must be a strict subset: it must not list a sibling-only article.
  const childLinks = [...childHtml.matchAll(/href="(\/moteur\/[^"]+)"/g)].map((m) => m[1])
  const nonChild = childLinks.filter((h) => !h.startsWith('/moteur/vh-moteur/') && h !== PARENT)
  assertEqual(
    nonChild.length,
    0,
    `the child category listed articles from outside itself: ${JSON.stringify(nonChild.slice(0, 3))}`,
  )

  console.error(`  child lists ${childLinks.length} of its own; parent rolls up`)
})

ok('NESTED_OK')
