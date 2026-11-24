/**
 * BO-G24 — the editor's media tools, driven as a journalist in a real browser.
 *
 * A throwaway journalist opens a new article (autosave creates it, g83-… author stamp) and:
 *  - inserts « Galerie photos » from the slash menu; the layout chooser shows six drawn options
 *    with Grille checked and the column choice offered; choosing « Diaporama » hides the column
 *    choice;
 *  - « Choisir plusieurs photos dans la médiathèque » opens the Médiathèque with row checkboxes;
 *    ticking three photos shows « Sélectionner 3 » as the drawer's primary (VH-blue) action, and
 *    it adds exactly those three photos as rows, in the order ticked, and closes the drawer;
 *  - inserts « Vidéo ou publication »: an empty link says where the preview will appear, a short
 *    TikTok link is refused with its instruction, an Instagram link is named « Instagram ·
 *    publication » and previewed in a frame at the address lib/embeds rebuilds;
 *  - pastes an Instagram reel, a TikTok and an X link, each on an empty line → three more link
 *    blocks; pastes a link inside a sentence → no block (the link stays in the text: control);
 *  - autosave stores it all: the article's latest version holds the carousel gallery with the
 *    three chosen media ids in order, then the five links in order, and the sentence with its link.
 * Screenshots: test-results/backoffice/editor/.
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { tsImport } from 'tsx/esm/api'

import { withPage } from './lib/browser.mjs'
import { browserLogin, cleanupGate, createUsers, stampFor } from './lib/backoffice.mjs'
import { ROOT, check, checkEqual, ok, pgClient, withCleanup } from './lib/harness.mjs'

const { parseEmbed } = await tsImport(path.join(ROOT, 'src/lib/embeds.ts'), import.meta.url)
const OUT = path.join(ROOT, 'test-results', 'backoffice', 'editor')
mkdirSync(OUT, { recursive: true })
const BLUE = 'rgb(22, 111, 193)'
const s = stampFor('g83')
await cleanupGate(s.anyRun)

const IG_POST = 'https://www.instagram.com/p/B2WMmBohFOg/?utm_source=ig_web_copy_link'
const PASTED = [
  'https://www.instagram.com/reel/C_3YC4stlJ1/',
  'https://www.tiktok.com/@bloom_media/video/7218664686135364870',
  'https://x.com/AchrafHakimi/status/2029652402450903499',
]
const IN_SENTENCE = 'https://vimeo.com/76979871'

async function latestBody(id) {
  const c = await pgClient()
  try {
    return (await c.query('select version_body from _articles_v where parent_id = $1 and latest', [id])).rows[0]
      ?.version_body
  } finally {
    await c.end()
  }
}

await withCleanup(
  async () => {
    const u = createUsers(s, ['journalist'])
    await withPage(
      async ({ page, baseUrl, pageErrors }) => {
        await browserLogin(page, baseUrl, u.journalist.email)
        await page.goto(`${baseUrl}/admin/collections/articles/create/`, { waitUntil: 'load' })
        await page.waitForURL(/\/articles\/\d+\/?$/, { timeout: 60_000 })
        const id = Number(page.url().match(/articles\/(\d+)/)[1])
        const editor = page.locator('[data-lexical-editor="true"]').first()
        await editor.waitFor({ state: 'visible', timeout: 30_000 })
        const lastLine = () => editor.locator(':scope > p').last()
        // Click the last (empty) line and wait until the caret is really there: Lexical syncs its
        // selection from `selectionchange` a moment after the click, and a paste sent before that
        // goes nowhere. A focus that never reaches the editor fails here, by name.
        const toLastLine = async () => {
          // Scroll first and let the page settle: a click sent mid-scroll can land on the
          // preview frame that was under the pointer a moment earlier (measured — no overlap
          // once settled, and a person never clicks a page that is still moving).
          await lastLine().scrollIntoViewIfNeeded()
          await page.waitForTimeout(400)
          await lastLine().click()
          await page
            .waitForFunction(
              () => {
                const sel = window.getSelection()
                const p = [...document.querySelectorAll('[data-lexical-editor="true"] > p')].pop()
                return document.activeElement?.getAttribute('data-lexical-editor') === 'true' && !!sel?.anchorNode && !!p?.contains(sel.anchorNode)
              },
              null,
              { timeout: 5_000 },
            )
            .catch(async () => {
              throw new Error(`caret not on the last line after a click (focus: ${await page.evaluate(() => document.activeElement?.tagName)})`)
            })
          await page.waitForTimeout(250)
        }
        const slash = async (query, itemId) => {
          await page.keyboard.type(`/${query}`, { delay: 40 })
          const item = page.locator(`#slash-menu-popup__item-block-${itemId}`)
          await item.waitFor({ state: 'visible', timeout: 10_000 })
          await page.waitForTimeout(400)
          await page.keyboard.press('Enter')
        }

        // ── gallery ──────────────────────────────────────────────────────────────
        await editor.click()
        await slash('gal', 'gallery')
        checkEqual(
          await editor.locator(':scope > p').evaluateAll((ps) => ps.filter((p) => p.textContent.includes('/')).length),
          0,
          'lines still holding the typed slash command',
        )
        const gallery = page.locator('.LexicalEditorTheme__block-gallery')
        await gallery.locator('[data-layout-picker]').waitFor({ state: 'visible', timeout: 15_000 })
        checkEqual(
          (await gallery.locator('[data-layout]').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-layout')))).join(','),
          'grid,mosaic,masonry,row,stack,carousel',
          'layout choices',
        )
        checkEqual(await gallery.locator('[data-layout="grid"] input').isChecked(), true, 'Grille checked by default')
        check((await gallery.locator('#field-columns').count()) > 0, 'column choice missing for the grid')
        await gallery.locator('[data-layout="carousel"]').click()
        checkEqual(await gallery.locator('[data-layout="carousel"] input').isChecked(), true, 'Diaporama checked after its click')
        await page.waitForTimeout(300)
        checkEqual(await gallery.locator('#field-columns').count(), 0, 'column choice shown for the slideshow')

        await gallery.locator('#gallery-pick-many').click()
        const drawer = page.locator('dialog.list-drawer[open]')
        await drawer.waitFor({ state: 'visible', timeout: 15_000 })
        const boxes = drawer.locator('tbody input[type="checkbox"]')
        await boxes.first().waitFor({ state: 'visible', timeout: 15_000 })
        const picked = []
        for (const i of [1, 3, 5]) {
          await boxes.nth(i).check()
          picked.push((await drawer.locator('tbody tr').nth(i).locator('.default-cell__first-cell, td a, td button').first().textContent()).trim())
        }
        const confirm = drawer.getByRole('button', { name: 'Sélectionner 3' })
        await confirm.waitFor({ state: 'visible', timeout: 10_000 })
        checkEqual(await confirm.evaluate((b) => getComputedStyle(b).backgroundColor), BLUE, '« Sélectionner 3 » colour')
        await confirm.click()
        await drawer.waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {})
        checkEqual(await page.locator('dialog.list-drawer[open]').count(), 0, 'open drawers after « Sélectionner 3 »')
        const c = await pgClient()
        let pickedIds
        try {
          pickedIds = []
          for (const name of picked) pickedIds.push((await c.query('select id from media where filename = $1', [name])).rows[0]?.id)
        } finally {
          await c.end()
        }
        check(pickedIds.every(Boolean), `ticked files not found in media: ${picked.join(', ')}`)
        await page.waitForTimeout(500)
        await gallery.screenshot({ path: path.join(OUT, '01-gallery-block.png') })

        // ── link block ───────────────────────────────────────────────────────────
        await toLastLine()
        await slash('vid', 'videoEmbed')
        const linkBlock = page.locator('.LexicalEditorTheme__block-videoEmbed').first()
        await linkBlock.locator('[data-embed-preview]').waitFor({ state: 'visible', timeout: 15_000 })
        checkEqual(await linkBlock.locator('[data-embed-preview]').getAttribute('data-embed-preview'), 'empty', 'preview before a link')
        const url = linkBlock.locator('#field-url')
        await url.fill('https://vm.tiktok.com/ZMabcdef/')
        await page.waitForTimeout(500)
        checkEqual(await linkBlock.locator('[data-embed-preview]').getAttribute('data-embed-preview'), 'refused', 'preview of a short TikTok link')
        check(/raccourci/.test(await linkBlock.locator('[data-embed-preview]').textContent()), 'short-link refusal without its instruction')
        await url.fill(IG_POST)
        await page.waitForTimeout(800)
        checkEqual(await linkBlock.locator('[data-embed-preview]').getAttribute('data-embed-preview'), 'instagram', 'preview of an Instagram link')
        checkEqual((await linkBlock.locator('.vhb-embed-preview__head strong').textContent()).trim(), 'Instagram · publication', 'platform named')
        checkEqual(await linkBlock.locator('iframe').getAttribute('src'), parseEmbed(IG_POST).embedSrc, 'preview frame address')
        await page.waitForTimeout(4000)
        await linkBlock.screenshot({ path: path.join(OUT, '02-link-block.png') })

        // ── paste ────────────────────────────────────────────────────────────────
        const paste = (text) =>
          page.evaluate((t) => {
            const root = document.querySelector('[data-lexical-editor="true"]')
            const dt = new DataTransfer()
            dt.setData('text/plain', t)
            root.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
          }, text)
        const blocks = page.locator('.LexicalEditorTheme__block-videoEmbed')
        for (const [i, link] of PASTED.entries()) {
          await toLastLine()
          await paste(link)
          await blocks.nth(i + 1).locator('[data-embed-preview]').waitFor({ state: 'visible', timeout: 10_000 })
        }
        checkEqual(
          (await blocks.locator('[data-embed-preview]').evaluateAll((e) => e.map((x) => x.getAttribute('data-embed-preview')))).join(','),
          'instagram,instagram,tiktok,x',
          'link blocks after three pastes',
        )
        await toLastLine()
        await page.keyboard.type('Voir aussi zzsentence ')
        await paste(IN_SENTENCE)
        await page.waitForTimeout(800)
        checkEqual(await blocks.count(), 4, 'link blocks after pasting into a sentence (control: none added)')

        // ── autosave ─────────────────────────────────────────────────────────────
        let stored = null
        for (let t = 0; t < 40; t += 1) {
          await page.waitForTimeout(500)
          const b = await latestBody(id)
          const kids = b?.root?.children ?? []
          const links = kids.filter((n) => n.fields?.blockType === 'videoEmbed').map((n) => n.fields.url)
          const g = kids.find((n) => n.fields?.blockType === 'gallery')?.fields
          const sentence = kids.find((n) => JSON.stringify(n).includes('zzsentence'))
          stored = { layout: g?.layout, images: g?.images?.map((r) => r.image), links, sentence: JSON.stringify(sentence ?? '') }
          if (links.length === 4 && stored.sentence.includes(IN_SENTENCE) && stored.layout === 'carousel') break
        }
        checkEqual(stored.layout, 'carousel', 'stored gallery layout')
        checkEqual(JSON.stringify(stored.images), JSON.stringify(pickedIds), 'stored gallery photos, in the order ticked')
        checkEqual(JSON.stringify(stored.links), JSON.stringify([IG_POST, ...PASTED]), 'stored links, in order')
        check(stored.sentence.includes(IN_SENTENCE), `the link pasted into a sentence is not in its paragraph: ${stored.sentence.slice(0, 300)}`)
        check(!pageErrors.length, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
        console.error(
          `  article ${id}: 6 drawn layouts → Diaporama; 3 photos in one step, stored in the order ticked; link refused/recognised/previewed; 3 pastes → blocks, sentence paste → text; autosaved`,
        )
      },
      { viewport: { width: 1600, height: 1000 } },
    )
  },
  async () => {
    const r = await cleanupGate(s.patterns)
    check(
      Object.values(r.left).every((n) => n === 0),
      `cleanup left rows: ${JSON.stringify(r.left)}`,
    )
  },
)
ok('BO_EDITOR_MEDIA_OK')
