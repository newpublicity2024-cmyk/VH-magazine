/**
 * BO-G22 — a published article with one link block per platform shows each one on its public
 * page, loads nothing third-party until the reader gets there, and then every player works.
 *
 * Fixture (slug g81-…): ~10,000 px of text, then YouTube (captioned), Vimeo, a Facebook video, a
 * Facebook reel, a Facebook post, an Instagram post and reel, a TikTok, an X post and a Dailymotion
 * link (captioned) — real links from VH's archive. Then, against `next start`:
 *
 *  Server HTML (scripts stripped): one `[data-embed]` per block with the provider; each player
 *  frame carries the address lib/embeds rebuilds (`data-src`; also `src` for fixed shapes, never
 *  for Instagram/X, whose address waits for the height listener) and `loading="lazy"`; « Voir
 *  sur … » links to the rebuilt permalink; YouTube is the poster button with no frame;
 *  Dailymotion is a link card with no frame; no provider script tag anywhere.
 *
 *  Browser (1280×900): at the top of the article, zero requests to any provider host; scrolled to
 *  each player, its frame is a provider document with content; Instagram and X frames take the
 *  height their content reports (data-height changes and the frame measures it); the YouTube
 *  poster mounts youtube-nocookie on click. The request detector must then count provider
 *  requests (its positive control). axe on the blocks (third-party frames excluded): zero
 *  serious or critical. Screenshots in test-results/backoffice/embeds/.
 */
import { mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { tsImport } from 'tsx/esm/api'

import { withPage } from './lib/browser.mjs'
import { cleanupGate, fixtureRefs, runDriver, stampFor } from './lib/backoffice.mjs'
import { ROOT, check, checkEqual, fail, getHtml, ok, stripScripts, withCleanup } from './lib/harness.mjs'

let AxeBuilder
try {
  ;({ default: AxeBuilder } = await import('@axe-core/playwright'))
} catch {
  fail('@axe-core/playwright is not installed. Run `pnpm install`.')
}
const { parseEmbed } = await tsImport(path.join(ROOT, 'src/lib/embeds.ts'), import.meta.url)

const OUT = path.join(ROOT, 'test-results', 'backoffice', 'embeds')
mkdirSync(OUT, { recursive: true })
const s = stampFor('g81')
await cleanupGate(s.anyRun)
const { categoryId, mediaIds } = await fixtureRefs(1)
const slug = s.slug('liens')
const oid = () => randomBytes(12).toString('hex')

const LINKS = [
  ['youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'zzcaption-youtube'],
  ['vimeo', 'https://player.vimeo.com/video/925084314?h=50605b080c', null],
  ['fb-video', 'https://www.facebook.com/Tomobile360/videos/1409970240554716/', null],
  ['fb-reel', 'https://www.facebook.com/reel/1409970240554716', null],
  ['fb-post', 'https://www.facebook.com/dw.stories/posts/3074497832661934', null],
  ['ig-post', 'https://www.instagram.com/p/B2WMmBohFOg/', null],
  ['ig-reel', 'https://www.instagram.com/reel/C_3YC4stlJ1/', null],
  ['tiktok', 'https://www.tiktok.com/@bloom_media/video/7218664686135364870', null],
  ['x', 'https://twitter.com/AchrafHakimi/status/2029652402450903499', null],
  ['dailymotion', 'https://www.dailymotion.com/video/x84sh87', 'zzcaption-dailymotion'],
]
const PROVIDER_HOSTS =
  /(^|\.)(youtube-nocookie\.com|youtube\.com|vimeo\.com|vimeocdn\.com|facebook\.com|facebook\.net|fbcdn\.net|instagram\.com|cdninstagram\.com|tiktok\.com|tiktokcdn\.com|tiktokv\.com|ttwstatic\.com|twitter\.com|twimg\.com|x\.com|dailymotion\.com|dmcdn\.net)$/i

const para = (text) => ({
  type: 'paragraph',
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  textFormat: 0,
  children: [{ type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
})
const filler =
  'Le texte de l’article avance ici, assez long pour que les lecteurs fassent défiler la page avant de rencontrer la première vidéo ; un lecteur qui ne descend pas jusque-là ne doit rien télécharger des plateformes sociales, ni script ni cadre, et le site ne doit leur transmettre aucune visite. '
const body = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      ...Array.from({ length: 80 }, (_, i) => para(`${i === 0 ? 'zzopening ' : ''}${filler}`)),
      ...LINKS.flatMap(([key, url, caption]) => [
        para(`Avant le bloc ${key}.`),
        {
          type: 'block',
          format: '',
          version: 2,
          fields: { id: oid(), blockName: '', blockType: 'videoEmbed', url, ...(caption ? { caption } : {}) },
        },
      ]),
      para('zzclosing'),
    ],
  },
}
const decode = (v) => v.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")

await withCleanup(
  async () => {
    runDriver(`
await p.create({ collection: 'articles', overrideAccess: true, context: { skipRedirects: true }, data: {
  title: ${JSON.stringify(s.title('Vidéos et publications'))},
  slug: ${JSON.stringify(slug)},
  category: ${categoryId},
  featuredImage: ${mediaIds[0]},
  body: ${JSON.stringify(body)},
  _status: 'published',
} })
print({ ok: true })
`)
    await withPage(
      async ({ page, baseUrl, pageErrors }) => {
        const url = `${baseUrl}/moteur/vh-moteur/${slug}/`
        // ── server HTML ──────────────────────────────────────────────────────────
        const { status, html } = await getHtml(url)
        checkEqual(status, 200, 'fixture article status')
        const dom = stripScripts(html)
        check(
          !/<script[^>]+src="[^"]*(instagram\.com|twitter\.com|platform\.x\.com|tiktok\.com|connect\.facebook\.net|dailymotion)/i.test(html),
          'a provider script tag is in the page',
        )
        const figures = [...dom.matchAll(/<figure\b[^>]*data-embed[^>]*>([\s\S]*?)<\/figure>/g)].map((m) => m[0])
        const providerOf = (f) => f.match(/data-provider="([a-z]+)"/)?.[1]
        checkEqual(
          figures.map(providerOf).join(','),
          'youtube,vimeo,facebook,facebook,facebook,instagram,instagram,tiktok,x,dailymotion',
          'link blocks in page order',
        )
        LINKS.forEach(([key, link, caption], i) => {
          const f = figures[i]
          const p = parseEmbed(link)
          if (key === 'youtube') {
            check(/data-video-facade/.test(f), 'YouTube block without its poster button')
            check(!/<iframe/.test(f), 'YouTube block ships a frame before the click')
            check(f.includes(caption), 'YouTube caption missing')
            return
          }
          if (key === 'dailymotion') {
            check(!/<iframe/.test(f), 'Dailymotion block has a frame')
            const href = decode(f.match(/<a[^>]*data-embed-link[^>]*href="([^"]+)"|<a[^>]*href="([^"]+)"[^>]*data-embed-link/)?.slice(1).find(Boolean) ?? '')
            checkEqual(href, p.canonicalUrl, 'Dailymotion card link')
            check(f.includes(caption), 'Dailymotion caption missing')
            return
          }
          const frame = f.match(/<iframe\b[^>]*>/)?.[0]
          check(frame, `${key}: no player frame`)
          checkEqual(decode(frame.match(/data-src="([^"]+)"/)?.[1] ?? ''), p.embedSrc, `${key}: player address`)
          check(/\sloading="lazy"/.test(frame), `${key}: frame is not lazy`)
          check(/\stitle="[^"]{6,}"/.test(frame), `${key}: frame without a title`)
          const src = frame.match(/\ssrc="([^"]+)"/)?.[1]
          if (p.heightOrigin) check(!src, `${key}: Instagram/X frame has its address before the height listener`)
          else checkEqual(decode(src ?? ''), p.embedSrc, `${key}: fixed-shape frame src`)
          const source = f.match(/<a[^>]*href="([^"]+)"[^>]*data-embed-source/)
          checkEqual(decode(source?.[1] ?? ''), p.canonicalUrl, `${key}: « Voir sur » link`)
          check(/rel="noopener noreferrer"/.test(f), `${key}: external link without noopener`)
        })

        // ── browser ──────────────────────────────────────────────────────────────
        const thirdParty = []
        page.on('request', (r) => {
          try {
            if (PROVIDER_HOSTS.test(new URL(r.url()).hostname)) thirdParty.push(`${r.resourceType()} ${r.url().slice(0, 90)}`)
          } catch {
            /* data: and blob: URLs */
          }
        })
        await page.goto(url, { waitUntil: 'load', timeout: 60_000 })
        await page.locator('[data-embed]').first().waitFor({ state: 'attached' })
        await page.waitForTimeout(4000)
        checkEqual(thirdParty.length, 0, `provider requests at the top of the article (${thirdParty.slice(0, 3).join(' | ')})`)

        const embeds = page.locator('[data-embed]')
        const frameTexts = {}
        for (const [i, [key]] of LINKS.entries()) {
          const el = embeds.nth(i)
          await el.scrollIntoViewIfNeeded()
          if (key === 'youtube') {
            await el.locator('[data-video-facade]').click()
            const yt = el.locator('iframe')
            await yt.waitFor({ state: 'attached', timeout: 15_000 })
            check(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/.test(await yt.getAttribute('src')), 'YouTube frame after the click')
          } else if (key !== 'dailymotion') {
            const iframe = el.locator('iframe')
            const expected = await iframe.getAttribute('data-src')
            let text = ''
            for (let t = 0; t < 60 && !text; t += 1) {
              await page.waitForTimeout(500)
              const frame = page.frames().find((fr) => fr.url().split('#')[0] === expected)
              if (frame) text = await frame.evaluate(() => document.body?.innerText?.trim() ?? '').catch(() => '')
            }
            check(text, `${key}: the provider's frame never showed content (${expected})`)
            frameTexts[key] = text.replace(/\s+/g, ' ').slice(0, 60)
            // The placeholder height the parser gives — the frame may have reported before now.
            const initial = parseEmbed(LINKS[i][1]).initialHeight
            if (key.startsWith('ig-') || key === 'x') {
              let h = initial
              for (let t = 0; t < 50 && h === initial; t += 1) {
                await page.waitForTimeout(500)
                h = Number(await iframe.getAttribute('data-height'))
              }
              check(h !== initial, `${key}: the frame kept its placeholder height ${initial} (no height reported)`)
              const box = await iframe.evaluate((n) => n.getBoundingClientRect().height)
              check(Math.abs(box - h) <= 1, `${key}: frame measures ${box}px, reported ${h}px`)
              frameTexts[key] += ` [${initial}→${h}px]`
            }
          }
          await page.waitForTimeout(300)
          await el.screenshot({ path: path.join(OUT, `${String(i + 1).padStart(2, '0')}-${key}.png`) })
        }
        check(thirdParty.length > 0, 'the provider-request detector counted nothing after scrolling (control)')

        let axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        axe = axe.include('[data-embed]').exclude('[data-embed] iframe')
        const res = await axe.analyze()
        check(res.passes.length + res.violations.length > 0, 'axe evaluated nothing in the link blocks (control)')
        const blocking = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        check(
          !blocking.length,
          `axe: ${blocking.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target} ${JSON.stringify(v.nodes[0]?.any?.[0]?.data ?? '')}`).join('; ')}`,
        )
        check(!pageErrors.length, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
        console.error(
          `  ${LINKS.length} blocks; 0 provider requests before scrolling, ${thirdParty.length} after; frames: ${Object.entries(frameTexts).map(([k, v]) => `${k} «${v}»`).join('; ')}`,
        )
      },
      { viewport: { width: 1280, height: 900 } },
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
ok('BO_EMBED_RENDER_OK')
