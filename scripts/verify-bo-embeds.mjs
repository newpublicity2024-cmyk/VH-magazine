/**
 * BO-G20 — the link block's parser rebuilds every player address from validated ids, and the
 * archive's stored video blocks survive the change.
 *
 * 1. A corpus of real link shapes — taken from VH's archive bodies (vh_migration, 2026-11-24) and
 *    the providers' share sheets — must each resolve to the expected provider, kind, shape,
 *    player address and permalink. Every address must start with an allow-listed origin.
 * 2. Hostile and unsupported links must be refused: lookalike hosts, userinfo, ports, other
 *    schemes, profiles, hashtags, id-less short links, a Facebook plugin wrapping another site,
 *    malformed ids. A marker string planted in every hostile input must never reach an output.
 *    Short links and profiles must get their own instruction.
 * 3. Every `videoEmbed` block stored in the archive (read-only) must pass the block's validator
 *    and resolve to YouTube with the same id the original rule (`videoId`) read. The count is
 *    measured twice, by a JSON path and by a text search, and must agree.
 *
 * The validator is the strict parser alone; the archive check is what shows dropping the original
 * YouTube rule (`videoId`, which read an id anywhere in the text) costs no stored block.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { tsImport } from 'tsx/esm/api'

import { ROOT, check, checkEqual, fail, ok } from './lib/harness.mjs'

const imp = (p) => tsImport(path.join(ROOT, p), import.meta.url)
const { parseEmbed, embedRefusal, EMBED_FRAME_ORIGINS, reportedHeight } = await imp('src/lib/embeds.ts')
const { videoId } = await imp('src/lib/youtube.ts')
const { VideoEmbedBlock } = await imp('src/blocks/VideoEmbed.ts')
const validate = VideoEmbedBlock.fields.find((f) => f.name === 'url').validate

const YT = 'https://www.youtube-nocookie.com/embed/'
const FBV = 'https://www.facebook.com/plugins/video.php?href='
const FBP = 'https://www.facebook.com/plugins/post.php?href='
const e = encodeURIComponent
const cases = [
  // [input, provider, kind, shape, embedSrc (null = card), canonicalUrl]
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'youtube', 'video', 'landscape', `${YT}dQw4w9WgXcQ`, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'youtube', 'video', 'landscape', `${YT}dQw4w9WgXcQ`, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['https://m.youtube.com/shorts/aqz-KE-bpKQ', 'youtube', 'reel', 'landscape', `${YT}aqz-KE-bpKQ`, 'https://www.youtube.com/shorts/aqz-KE-bpKQ'],
  ['https://www.youtube.com/live/dQw4w9WgXcQ', 'youtube', 'video', 'landscape', `${YT}dQw4w9WgXcQ`, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 'video', 'landscape', `${YT}dQw4w9WgXcQ`, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['https://vimeo.com/76979871', 'vimeo', 'video', 'landscape', 'https://player.vimeo.com/video/76979871?dnt=1', 'https://vimeo.com/76979871'],
  ['https://player.vimeo.com/video/925084314?h=50605b080c', 'vimeo', 'video', 'landscape', 'https://player.vimeo.com/video/925084314?dnt=1&h=50605b080c', 'https://vimeo.com/925084314/50605b080c'],
  ['https://vimeo.com/channels/staffpicks/76979871', 'vimeo', 'video', 'landscape', 'https://player.vimeo.com/video/76979871?dnt=1', 'https://vimeo.com/76979871'],
  ['https://www.dailymotion.com/video/x84sh87', 'dailymotion', 'video', 'landscape', null, 'https://www.dailymotion.com/video/x84sh87'],
  ['https://dai.ly/x84sh87', 'dailymotion', 'video', 'landscape', null, 'https://www.dailymotion.com/video/x84sh87'],
  ['https://www.dailymotion.com/embed/video/k3KrmgbjTA3COWywZ09?pubtool=oembed', 'dailymotion', 'video', 'landscape', null, 'https://www.dailymotion.com/video/k3KrmgbjTA3COWywZ09'],
  ['https://www.facebook.com/watch/?v=1409970240554716', 'facebook', 'video', 'landscape', `${FBV}${e('https://www.facebook.com/watch/?v=1409970240554716')}&show_text=false&t=0`, 'https://www.facebook.com/watch/?v=1409970240554716'],
  ['https://web.facebook.com/Tomobile360/videos/1409970240554716/', 'facebook', 'video', 'landscape', `${FBV}${e('https://www.facebook.com/Tomobile360/videos/1409970240554716/')}&show_text=false&t=0`, 'https://www.facebook.com/Tomobile360/videos/1409970240554716/'],
  ['https://www.facebook.com/plugins/video.php?height=314&href=https%3A%2F%2Fweb.facebook.com%2FTomobile360%2Fvideos%2F1409970240554716%2F&show_text=false&width=560&t=0', 'facebook', 'video', 'landscape', `${FBV}${e('https://www.facebook.com/Tomobile360/videos/1409970240554716/')}&show_text=false&t=0`, 'https://www.facebook.com/Tomobile360/videos/1409970240554716/'],
  ['https://www.facebook.com/reel/1409970240554716', 'facebook', 'reel', 'portrait', `${FBV}${e('https://www.facebook.com/reel/1409970240554716')}&show_text=false&t=0`, 'https://www.facebook.com/reel/1409970240554716'],
  ['https://www.facebook.com/dw.stories/posts/3074497832661934', 'facebook', 'post', 'post', `${FBP}${e('https://www.facebook.com/dw.stories/posts/3074497832661934')}&show_text=true&width=500`, 'https://www.facebook.com/dw.stories/posts/3074497832661934'],
  ['https://fb.watch/6pmdA2ig_M/', 'facebook', 'video', 'landscape', `${FBV}${e('https://fb.watch/6pmdA2ig_M/')}&show_text=false&t=0`, 'https://fb.watch/6pmdA2ig_M/'],
  ['https://www.instagram.com/p/B2WMmBohFOg/?utm_source=ig_embed&utm_campaign=loading', 'instagram', 'post', 'post', 'https://www.instagram.com/p/B2WMmBohFOg/embed/captioned/', 'https://www.instagram.com/p/B2WMmBohFOg/'],
  ['https://www.instagram.com/reel/C_3YC4stlJ1/', 'instagram', 'reel', 'post', 'https://www.instagram.com/reel/C_3YC4stlJ1/embed/captioned/', 'https://www.instagram.com/reel/C_3YC4stlJ1/'],
  ['https://www.instagram.com/reel/DZNNSVJNoxN/embed', 'instagram', 'reel', 'post', 'https://www.instagram.com/reel/DZNNSVJNoxN/embed/captioned/', 'https://www.instagram.com/reel/DZNNSVJNoxN/'],
  ['https://www.instagram.com/tv/CFu4ziuBQFg/', 'instagram', 'post', 'post', 'https://www.instagram.com/p/CFu4ziuBQFg/embed/captioned/', 'https://www.instagram.com/p/CFu4ziuBQFg/'],
  ['instagram.com/gadelmaleh/p/B2WMmBohFOg/', 'instagram', 'post', 'post', 'https://www.instagram.com/p/B2WMmBohFOg/embed/captioned/', 'https://www.instagram.com/p/B2WMmBohFOg/'],
  ['https://www.tiktok.com/@bloom_media/video/7218664686135364870', 'tiktok', 'video', 'portrait', 'https://www.tiktok.com/player/v1/7218664686135364870?rel=0', 'https://www.tiktok.com/@bloom_media/video/7218664686135364870'],
  ['https://m.tiktok.com/@canalplussport/video/7510892083813698838?is_from_webapp=1', 'tiktok', 'video', 'portrait', 'https://www.tiktok.com/player/v1/7510892083813698838?rel=0', 'https://www.tiktok.com/@canalplussport/video/7510892083813698838'],
  ['https://twitter.com/AchrafHakimi/status/2029652402450903499?ref_src=twsrc%5Etfw', 'x', 'post', 'post', 'https://platform.twitter.com/embed/Tweet.html?id=2029652402450903499&dnt=true&lang=fr', 'https://x.com/AchrafHakimi/status/2029652402450903499'],
  ['https://x.com/MSNBC/status/1364300282499375111/photo/1', 'x', 'post', 'post', 'https://platform.twitter.com/embed/Tweet.html?id=1364300282499375111&dnt=true&lang=fr', 'https://x.com/MSNBC/status/1364300282499375111'],
  ['https://mobile.twitter.com/i/web/status/1364300282499375111', 'x', 'post', 'post', 'https://platform.twitter.com/embed/Tweet.html?id=1364300282499375111&dnt=true&lang=fr', 'https://x.com/i/status/1364300282499375111'],
]

const MARK = 'zzevilzz'
const refused = [
  `https://not${MARK}youtube.com/watch?v=dQw4w9WgXcQ`,
  `https://youtube.com.${MARK}.tld/watch?v=dQw4w9WgXcQ`,
  `https://instagram.com.${MARK}.tld/p/B2WMmBohFOg/`,
  `https://${MARK}instagram.com/p/B2WMmBohFOg/`,
  `https://${MARK}@www.youtube.com/watch?v=dQw4w9WgXcQ`,
  `https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ&${MARK}`,
  `javascript:alert('${MARK}')//youtube.com/watch?v=dQw4w9WgXcQ`,
  `data:text/html,${MARK}<script>`,
  `ftp://www.youtube.com/watch?v=dQw4w9WgXcQ${MARK}`,
  `https://www.youtube.com/watch?v=${MARK}`,
  `https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>${MARK}`,
  `https://twitter.com/hashtag/Maroc?src=${MARK}`,
  `https://x.com/${MARK}/status/notanumber`,
  `https://www.instagram.com/vh.magazine/?${MARK}`,
  `https://www.instagram.com/p/B2W%22${MARK}/`,
  `https://www.facebook.com/hashtag/vhtv?${MARK}`,
  `https://www.facebook.com/CasciariMauro/?${MARK}`,
  `https://www.facebook.com/plugins/video.php?href=${e(`https://${MARK}.tld/videos/1/`)}`,
  `https://www.facebook.com/plugins/video.php?href=${e(`https://www.facebook.com/plugins/video.php?href=${e('https://www.facebook.com/reel/123')}&${MARK}`)}`,
  `https://www.facebook.com/share/v/1AbCdEf${MARK}/`,
  `https://www.tiktok.com/@bloom_media?${MARK}`,
  `https://www.tiktok.com/@bloom_media/video/72186${MARK}`,
  `https://vm.tiktok.com/ZMabcdef${MARK}/`,
  `https://www.tiktok.com/t/ZT8abc${MARK}/`,
  `https://www.linkedin.com/posts/${MARK}`,
  `https://www.youtube.com/watch?v=dQw4w9WgXcQ ${MARK}`,
]

// ── 1. supported shapes ─────────────────────────────────────────────────────
for (const [input, provider, kind, shape, src, canonical] of cases) {
  const p = parseEmbed(input)
  check(p, `refused a supported link: ${input}`)
  checkEqual(`${p.provider}/${p.kind}/${p.shape}`, `${provider}/${kind}/${shape}`, `kind of ${input}`)
  checkEqual(p.embedSrc, src, `player address of ${input}`)
  checkEqual(p.canonicalUrl, canonical, `permalink of ${input}`)
  if (p.embedSrc) {
    check(
      EMBED_FRAME_ORIGINS.some((o) => p.embedSrc.startsWith(`${o}/`)),
      `player address outside the allow-list: ${p.embedSrc}`,
    )
    check(!/[\s"'<>]/.test(p.embedSrc), `unsafe character in ${p.embedSrc}`)
  }
  check(validate(input) === true, `the block validator refused ${input}`)
}
const heightProviders = cases.map(([i]) => parseEmbed(i)).filter((p) => p.heightOrigin)
checkEqual(
  [...new Set(heightProviders.map((p) => p.provider))].sort().join(','),
  'instagram,x',
  'providers that report their height',
)
checkEqual(reportedHeight('instagram', '{"type":"MEASURE","details":{"height":796}}'), 796, 'Instagram MEASURE message')
checkEqual(
  reportedHeight('x', { 'twttr.embed': { method: 'twttr.private.resize', params: [{ height: 644 }] } }),
  644,
  'X resize message',
)
checkEqual(reportedHeight('x', '{"type":"MEASURE","details":{"height":796}}'), null, 'an Instagram message read as X')

// ── 2. refusals ─────────────────────────────────────────────────────────────
for (const input of refused) {
  const p = parseEmbed(input)
  check(p === null, `accepted a hostile or unsupported link: ${input} → ${JSON.stringify(p)}`)
  const verdict = validate(input)
  check(typeof verdict === 'string' && verdict.length > 20, `the validator did not refuse ${input} with a message`)
  check(!verdict.includes(MARK), `the refusal echoes the input: ${verdict}`)
}
check(/raccourci/.test(embedRefusal('https://vm.tiktok.com/ZMabcdef/')), 'short TikTok link without its instruction')
check(/profil/.test(embedRefusal('https://www.instagram.com/vh.magazine/')), 'profile link without its instruction')
check(/YouTube, Vimeo/.test(embedRefusal('https://www.linkedin.com/posts/x')), 'unknown link without the platform list')

// ── 3. the archive's stored video blocks ────────────────────────────────────
const sql = (q) =>
  execFileSync('psql', ['-X', '-q', '-d', 'vh_migration', '-At', '-c', q], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  })
let urls
try {
  urls = sql(
    `select n->>'url' from articles a, jsonb_path_query(a.body, 'strict $.**.fields ? (@.blockType == "videoEmbed")') as t(n) where a.body is not null`,
  )
    .split('\n')
    .filter(Boolean)
} catch (error) {
  fail(`could not read the archive (vh_migration): ${error.message}`)
}
const byText = Number(
  sql(
    `select coalesce(sum((length(body::text) - length(replace(body::text, '"blockType": "videoEmbed"', ''))) / length('"blockType": "videoEmbed"')), 0) from articles where body is not null`,
  ).trim(),
)
check(urls.length > 0, 'no stored video block found in the archive (control)')
checkEqual(urls.length, byText, 'archive video blocks, by JSON path vs by text')
let changed = 0
for (const url of urls) {
  const verdict = validate(url)
  const p = parseEmbed(url)
  if (verdict !== true || p?.provider !== 'youtube' || p.id !== videoId(url)) {
    changed += 1
    if (changed <= 3) console.error(`  archive block changed: ${url} → ${JSON.stringify({ verdict, p })}`)
  }
}
checkEqual(changed, 0, 'archived video blocks refused or resolved to another video')

console.error(
  `  ${cases.length} link shapes resolved, ${refused.length} refused (marker never echoed), ${urls.length} archive blocks valid with their YouTube id`,
)
ok('BO_EMBEDS_OK')
