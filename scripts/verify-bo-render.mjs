/**
 * BO-G7 — every node the new editor toolset can produce renders on the public article page.
 *
 * Publishes one throwaway article (slug g71-…) whose body holds an h4, struck / sub / sup text,
 * a centred, a right-aligned and a justified paragraph, a table with a header row, a mosaic
 * gallery of three seeded images and a YouTube block — the exact JSON Lexical stores. Payload
 * validates the body against the configured features on save, so the write itself proves the
 * editor accepts these nodes. Then `next start` serves the article and the DOM (scripts
 * stripped) must show each one as the reader should see it, with exactly one h1.
 *
 * The negative ("justify is not applied") is judged beside its positive controls: the centred
 * and right-aligned paragraphs of the SAME body must carry their classes, so an absence cannot
 * pass because alignment rendering is broken altogether.
 */
import { randomBytes } from 'node:crypto'

import { cleanupGate, fixtureRefs, runDriver, stampFor } from './lib/backoffice.mjs'
import {
  check,
  checkEqual,
  getHtml,
  ok,
  stripScripts,
  withCleanup,
  withServer,
} from './lib/harness.mjs'

const s = stampFor('g71')
await cleanupGate(s.anyRun)
const { categoryId, mediaIds } = await fixtureRefs(3)
const slug = s.slug('rendu')
const oid = () => randomBytes(12).toString('hex')

const t = (text, format = 0) => ({
  type: 'text',
  text,
  format,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})
const para = (children, format = '') => ({
  type: 'paragraph',
  format,
  indent: 0,
  version: 1,
  direction: 'ltr',
  textFormat: 0,
  textStyle: '',
  children,
})
const heading = (tag, text) => ({
  type: 'heading',
  tag,
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  children: [t(text)],
})
const cell = (text, headerState) => ({
  type: 'tablecell',
  headerState,
  colSpan: 1,
  rowSpan: 1,
  backgroundColor: null,
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  children: [para([t(text)])],
})
const row = (cells) => ({
  type: 'tablerow',
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  children: cells,
})

const body = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      para([t('Ouverture zzopening du texte.')]),
      heading('h4', 'zzhfour intertitre'),
      para([t('zzstrike', 4), t(' puis '), t('zzsub', 32), t(' et '), t('zzsup', 64)]),
      para([t('zzcenter paragraphe centré')], 'center'),
      para([t('zzright paragraphe à droite')], 'right'),
      para([t('zzjustify paragraphe justifié')], 'justify'),
      {
        type: 'table',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          row([cell('zzhead1', 1), cell('zzhead2', 1)]),
          row([cell('zzcellv8', 0), cell('zzcell530', 0)]),
        ],
      },
      {
        type: 'block',
        format: '',
        version: 2,
        fields: {
          id: oid(),
          blockName: '',
          blockType: 'gallery',
          layout: 'mosaic',
          images: mediaIds.map((id, i) => ({ id: oid(), image: id, caption: `zzlegende${i + 1}` })),
        },
      },
      {
        type: 'block',
        format: '',
        version: 2,
        fields: {
          id: oid(),
          blockName: '',
          blockType: 'videoEmbed',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
      },
      para([t('Fin zzclosing.')]),
    ],
  },
}

await withCleanup(
  async () => {
    runDriver(`
await p.create({ collection: 'articles', overrideAccess: true, context: { skipRedirects: true }, data: {
  title: ${JSON.stringify(s.title('Rendu de l’éditeur'))},
  slug: ${JSON.stringify(slug)},
  category: ${categoryId},
  featuredImage: ${mediaIds[0]},
  body: ${JSON.stringify(body)},
  _status: 'published',
} })
print({ ok: true })
`)
    await withServer(async (base) => {
      const { status, html } = await getHtml(`${base}/moteur/vh-moteur/${slug}/`)
      checkEqual(status, 200, 'fixture article status')
      const dom = stripScripts(html)
      const has = (re, what) => check(re.test(dom), `${what} — not found in the article DOM`)

      checkEqual((dom.match(/<h1\b/g) ?? []).length, 1, 'h1 count')
      has(/<h4\b[^>]*>(?:(?!<\/h4>)[\s\S])*zzhfour/, 'h4 heading')
      has(/<s>zzstrike<\/s>/, 'struck text <s>')
      has(/<sub>zzsub<\/sub>/, 'subscript <sub>')
      has(/<sup>zzsup<\/sup>/, 'superscript <sup>')
      has(
        /<p class="vh-align-center">(?:(?!<\/p>)[\s\S])*zzcenter/,
        'centred paragraph (positive control for alignment)',
      )
      has(
        /<p class="vh-align-right">(?:(?!<\/p>)[\s\S])*zzright/,
        'right-aligned paragraph (positive control for alignment)',
      )
      has(/<p>(?:<span>)?zzjustify/, 'justified paragraph rendered as a plain paragraph')
      // Precise, not /justify/: the page's own layout classes (justify-between…) contain the word.
      check(
        !/vh-align-justify|text-align:\s*justify/i.test(dom),
        'a justify alignment reached the page',
      )

      has(/data-table[^>]*>\s*<table>/, 'table wrapper')
      checkEqual(
        (dom.match(/<th scope="col"[^>]*>(?:(?!<\/th>)[\s\S])*zzhead[12]/g) ?? []).length,
        2,
        'header cells',
      )
      has(/<td\b[^>]*>(?:(?!<\/td>)[\s\S])*zzcell530/, 'body cell')

      const gallery = dom.match(/<div[^>]*data-gallery="mosaic"[^>]*>([\s\S]*?)<\/div>/)
      check(gallery, 'mosaic gallery block')
      const imgs = gallery[1].match(/<img\b[^>]*>/g) ?? []
      checkEqual(imgs.length, 3, 'gallery images')
      for (const img of imgs) {
        check(
          /\swidth="\d+"/.test(img) && /\sheight="\d+"/.test(img),
          `gallery image without dimensions: ${img.slice(0, 160)}`,
        )
        check(
          /src="\/_next\/image\/?\?url=/.test(img),
          `gallery image not served through the optimizer: ${img.slice(0, 160)}`,
        )
      }
      checkEqual(
        (gallery[1].match(/<figcaption>zzlegende\d<\/figcaption>/g) ?? []).length,
        3,
        'gallery captions',
      )
      has(/data-video-facade/, 'YouTube click-to-load facade')
      has(/zzopening[\s\S]*zzclosing/, 'body text around the new nodes')
      console.error(
        `  /moteur/vh-moteur/${slug}/ renders h4, s/sub/sup, centre+right (no justify), table, 3-photo mosaic, YouTube facade; 1 h1`,
      )
    })
  },
  async () => {
    const r = await cleanupGate(s.patterns)
    check(
      Object.values(r.left).every((n) => n === 0),
      `cleanup left rows: ${JSON.stringify(r.left)}`,
    )
  },
)
ok('BO_RENDER_OK')
