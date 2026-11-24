/**
 * A pasted video or social-post link → a player address the site can frame, or a refusal.
 *
 * Shared by the editor's link block validator (blocks/VideoEmbed), its live preview in the admin,
 * the link-paste shortcut and the public renderer (components/SocialEmbed), so the editor can
 * never store a link the page cannot show. Pure and dependency-free for that reason — it is
 * imported by server code, client code and the gate scripts.
 *
 * Ported from lallafatema's `lib/embeds.ts`, keeping its posture: **rebuild, never reflect**.
 * A link block is writable by every journalist and its player address lands in an `src` on a
 * public page, so the only things carried forward from the pasted text are ids that passed a
 * strict charset; every address is a hard-coded origin plus those ids. Hosts match exactly or on a
 * dot boundary (`notyoutube.com` and `instagram.com.evil.tld` are refused), userinfo and explicit
 * ports are refused.
 *
 * VH differs from lallafatema where VH's archive and a measurement said so (2026-11-24):
 * - X / Twitter is supported (117 archive links): `platform.twitter.com/embed/Tweet.html` frames
 *   without the widgets script and reports its height.
 * - `fb.watch` short links are supported: Facebook's own plugin expands them (measured), so the
 *   rebuilt `https://fb.watch/<code>/` is a valid plugin `href`. Facebook embed addresses pasted
 *   whole (`/plugins/video.php?href=…`, 16 in the archive) are unwrapped one level.
 * - Dailymotion parses but does not play: its player answered 403 for vh.ma, localhost and no
 *   referrer, 200 only for a partner domain — it needs a player id from a partner account. Such a
 *   link renders as a card that opens Dailymotion (`embedSrc: null`).
 * - TikTok uses its Embed Player (`/player/v1/<id>`), which fills its frame; the older
 *   `/embed/v2/` draws a fixed-size card inside it.
 * - Scheme-less and `http:` links are accepted: the output is rebuilt from ids either way, and a
 *   journalist pasting `instagram.com/p/…` meant Instagram.
 */

export type EmbedProvider = 'youtube' | 'vimeo' | 'dailymotion' | 'facebook' | 'instagram' | 'tiktok' | 'x'
export type EmbedKind = 'video' | 'reel' | 'post'
/**
 * How the frame is sized on the page: `landscape` 16:9, `portrait` 9:16, `post` a card of the
 * provider's width whose height comes from the frame (Instagram, X) or is fixed (Facebook).
 */
export type EmbedShape = 'landscape' | 'portrait' | 'post'

export type ParsedEmbed = {
  provider: EmbedProvider
  kind: EmbedKind
  /** Provider-native id, validated against a strict charset. Never raw input. */
  id: string
  /** The frame's address, rebuilt; `null` when the provider will not play on vh.ma. */
  embedSrc: string | null
  /** Rebuilt permalink, for « Voir sur … » links. */
  canonicalUrl: string
  shape: EmbedShape
  /** The origin whose `postMessage` reports the frame's content height (Instagram, X). */
  heightOrigin: string | null
  /** The frame's height before it reports one (`post` shape), in CSS px. */
  initialHeight: number
}

export const PROVIDER_LABELS: Record<EmbedProvider, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  dailymotion: 'Dailymotion',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
}

export const KIND_LABELS: Record<EmbedKind, string> = {
  video: 'vidéo',
  reel: 'reel',
  post: 'publication',
}

/** The platforms, as a journalist reads them in the editor's messages. */
export const SUPPORTED_PLATFORMS_LABEL =
  'YouTube, Vimeo, Dailymotion, Facebook, Instagram, TikTok ou X (Twitter)'

const YOUTUBE_EMBED = 'https://www.youtube-nocookie.com'
const VIMEO_PLAYER = 'https://player.vimeo.com'
const DAILYMOTION = 'https://www.dailymotion.com'
const FACEBOOK = 'https://www.facebook.com'
const INSTAGRAM = 'https://www.instagram.com'
const TIKTOK = 'https://www.tiktok.com'
const X_EMBED = 'https://platform.twitter.com'

/** Every origin a non-null `embedSrc` can have — the frame allow-list (gate BO-G20 checks it). */
export const EMBED_FRAME_ORIGINS: readonly string[] = [
  YOUTUBE_EMBED,
  VIMEO_PLAYER,
  FACEBOOK,
  INSTAGRAM,
  TIKTOK,
  X_EMBED,
]

const MAX_INPUT_LENGTH = 2048
const SLUG_ID = /^[A-Za-z0-9_-]{1,64}$/
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const NUMERIC_ID = /^[0-9]{1,32}$/
const VIMEO_HASH = /^[0-9a-f]{6,20}$/
/** Facebook vanity name or page slug: letters, digits, dots, hyphens; never a route word. */
const FACEBOOK_ACTOR = /^[A-Za-z0-9][A-Za-z0-9.-]{0,79}$/
/** A Facebook post id: numeric, or the newer `pfbid…` form (letters and digits). */
const FACEBOOK_POST_ID = /^[A-Za-z0-9]{1,96}$/
const TIKTOK_ACTOR = /^[A-Za-z0-9._]{1,32}$/
const X_ACTOR = /^[A-Za-z0-9_]{1,15}$/

const FACEBOOK_ROUTES: ReadonlySet<string> = new Set([
  'plugins', 'watch', 'watch.php', 'reel', 'reels', 'video.php', 'photo.php', 'profile.php',
  'permalink.php', 'story.php', 'sharer', 'sharer.php', 'share', 'dialog', 'login', 'login.php',
  'groups', 'events', 'pages', 'marketplace', 'media', 'ajax', 'tr', 'l.php', 'p', 'hashtag',
  'gaming', 'stories', 'help', 'policies',
])

function hostMatches(host: string, domains: readonly string[]): boolean {
  return domains.some((d) => host === d || host.endsWith(`.${d}`))
}

/** The link as a URL we will reason about, or null. Accepts `http:` and a missing scheme. */
function parseUrl(input: unknown): URL | null {
  if (typeof input !== 'string') return null
  let text = input.trim()
  if (!text || text.length > MAX_INPUT_LENGTH || /\s/.test(text)) return null
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    // `instagram.com/p/…`, `www.youtube.com/…` — a host first, never a path or a scheme.
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(text)) return null
    text = `https://${text}`
  }
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username !== '' || url.password !== '' || url.port !== '') return null
  return url
}

function hostOf(url: URL): string {
  const h = url.hostname.toLowerCase()
  return h.endsWith('.') ? h.slice(0, -1) : h
}

function segmentsOf(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean)
}

function valid(value: string | null | undefined, pattern: RegExp = SLUG_ID): string | null {
  return typeof value === 'string' && pattern.test(value) ? value : null
}

const enc = encodeURIComponent

function embed(
  provider: EmbedProvider,
  kind: EmbedKind,
  id: string,
  embedSrc: string | null,
  canonicalUrl: string,
  shape: EmbedShape,
  extra: Partial<Pick<ParsedEmbed, 'heightOrigin' | 'initialHeight'>> = {},
): ParsedEmbed {
  return {
    provider,
    kind,
    id,
    embedSrc,
    canonicalUrl,
    shape,
    heightOrigin: extra.heightOrigin ?? null,
    initialHeight: extra.initialHeight ?? 0,
  }
}

function youtube(id: string, kind: EmbedKind): ParsedEmbed {
  return embed(
    'youtube',
    kind,
    id,
    `${YOUTUBE_EMBED}/embed/${enc(id)}`,
    kind === 'reel' ? `https://www.youtube.com/shorts/${enc(id)}` : `https://www.youtube.com/watch?v=${enc(id)}`,
    'landscape',
  )
}

function parseYouTube(url: URL, host: string, seg: string[]): ParsedEmbed | null {
  if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
    const id = valid(seg[0], YOUTUBE_ID)
    return id ? youtube(id, 'video') : null
  }
  if (seg[0] === 'watch') {
    const id = valid(url.searchParams.get('v'), YOUTUBE_ID)
    return id ? youtube(id, 'video') : null
  }
  if (['shorts', 'embed', 'live', 'v'].includes(seg[0] ?? '')) {
    const id = valid(seg[1], YOUTUBE_ID)
    return id ? youtube(id, seg[0] === 'shorts' ? 'reel' : 'video') : null
  }
  return null
}

/** `vimeo.com/<id>[/<hash>]`, `player.vimeo.com/video/<id>?h=<hash>`, channel/group/showcase forms. */
function parseVimeo(url: URL, host: string, seg: string[]): ParsedEmbed | null {
  let id: string | null = null
  let hash: string | null = null
  if (host === 'player.vimeo.com') {
    if (seg[0] === 'video') id = valid(seg[1], NUMERIC_ID)
    hash = valid(url.searchParams.get('h'), VIMEO_HASH)
  } else if (valid(seg[0], NUMERIC_ID)) {
    id = seg[0]
    hash = valid(seg[1], VIMEO_HASH)
  } else if (['channels', 'groups', 'showcase', 'album'].includes(seg[0] ?? '') && seg.length >= 3) {
    // The last numeric segment is the video; a bare `channels/<name>` has none worth reading.
    id = valid(seg[seg.length - 1], NUMERIC_ID)
  }
  if (!id) return null
  // An unlisted video plays only with its hash; the publisher has already shared it to embed.
  const h = hash ? `&h=${enc(hash)}` : ''
  return embed(
    'vimeo',
    'video',
    id,
    `${VIMEO_PLAYER}/video/${enc(id)}?dnt=1${h}`,
    `https://vimeo.com/${enc(id)}${hash ? `/${enc(hash)}` : ''}`,
    'landscape',
  )
}

/** `dailymotion.com/video/<id>[_<title>]`, `/embed/video/<id>`, `dai.ly/<id>` — a card, not a player. */
function parseDailymotion(host: string, seg: string[]): ParsedEmbed | null {
  let raw: string | undefined
  if (host === 'dai.ly' || host.endsWith('.dai.ly')) raw = seg[0]
  else if (seg[0] === 'video') raw = seg[1]
  else if (seg[0] === 'embed' && seg[1] === 'video') raw = seg[2]
  const id = valid(raw?.split('_')[0], /^[A-Za-z0-9]{5,32}$/)
  if (!id) return null
  return embed('dailymotion', 'video', id, null, `${DAILYMOTION}/video/${enc(id)}`, 'landscape')
}

function facebook(kind: EmbedKind, id: string, href: string): ParsedEmbed {
  if (kind === 'post') {
    return embed(
      'facebook',
      'post',
      id,
      `${FACEBOOK}/plugins/post.php?href=${enc(href)}&show_text=true&width=500`,
      href,
      'post',
      // Facebook reports no height without its SDK: a fixed frame that fits a photo post.
      { initialHeight: 680 },
    )
  }
  return embed(
    'facebook',
    kind,
    id,
    `${FACEBOOK}/plugins/video.php?href=${enc(href)}&show_text=false&t=0`,
    href,
    kind === 'reel' ? 'portrait' : 'landscape',
  )
}

function parseFacebook(url: URL, host: string, seg: string[], depth: number): ParsedEmbed | null {
  if (host === 'fb.watch' || host.endsWith('.fb.watch')) {
    const code = valid(seg[0], /^[A-Za-z0-9_-]{1,32}$/)
    return code ? facebook('video', code, `https://fb.watch/${enc(code)}/`) : null
  }
  const [first, second, third] = seg
  // A whole embed address pasted (`/plugins/video.php?href=…`): read the link it wraps, once.
  if (first === 'plugins' && depth === 0) {
    const inner = url.searchParams.get('href')
    const parsed = inner ? parseEmbedAt(inner, 1) : null
    return parsed?.provider === 'facebook' ? parsed : null
  }
  if (first === 'watch' || first === 'video.php' || first === 'watch.php') {
    const id = valid(url.searchParams.get('v'), NUMERIC_ID)
    return id ? facebook('video', id, `${FACEBOOK}/watch/?v=${enc(id)}`) : null
  }
  if (first === 'reel' || first === 'reels') {
    const id = valid(second, NUMERIC_ID)
    return id ? facebook('reel', id, `${FACEBOOK}/reel/${enc(id)}`) : null
  }
  if (!first || FACEBOOK_ROUTES.has(first.toLowerCase())) return null
  const actor = valid(first, FACEBOOK_ACTOR)
  if (!actor || actor.includes('..')) return null
  if (second === 'videos') {
    // `/<page>/videos/<id>/` and the older `/<page>/videos/<title-or-vb.N>/<id>/`.
    const id = valid(seg.slice(2).reverse().find((s) => NUMERIC_ID.test(s)), NUMERIC_ID)
    return id ? facebook('video', id, `${FACEBOOK}/${enc(actor)}/videos/${enc(id)}/`) : null
  }
  if (second === 'posts') {
    const id = valid(third, FACEBOOK_POST_ID)
    return id ? facebook('post', id, `${FACEBOOK}/${enc(actor)}/posts/${enc(id)}`) : null
  }
  return null
}

/** `/p/<code>`, `/reel/<code>`, `/reels/<code>`, `/tv/<code>`, also after a `/<user>/` prefix. */
function parseInstagram(seg: string[]): ParsedEmbed | null {
  const at = seg.findIndex((s) => ['p', 'reel', 'reels', 'tv'].includes(s))
  if (at < 0 || at > 1) return null
  const code = valid(seg[at + 1], /^[A-Za-z0-9_-]{5,64}$/)
  if (!code) return null
  const kind: EmbedKind = seg[at] === 'p' || seg[at] === 'tv' ? 'post' : 'reel'
  const path = kind === 'post' ? 'p' : 'reel'
  return embed(
    'instagram',
    kind,
    code,
    `${INSTAGRAM}/${path}/${enc(code)}/embed/captioned/`,
    `${INSTAGRAM}/${path}/${enc(code)}/`,
    'post',
    { heightOrigin: INSTAGRAM, initialHeight: kind === 'post' ? 640 : 760 },
  )
}

/** `/@<handle>/video/<id>` only: short `vm.`/`vt.`/`/t/` links carry no id (see refusal). */
function parseTikTok(host: string, seg: string[]): ParsedEmbed | null {
  if (host !== 'tiktok.com' && host !== 'www.tiktok.com' && host !== 'm.tiktok.com') return null
  const [first, second, third] = seg
  if (!first?.startsWith('@') || second !== 'video') return null
  const actor = valid(first.slice(1), TIKTOK_ACTOR)
  const id = valid(third, NUMERIC_ID)
  if (!actor || !id) return null
  return embed(
    'tiktok',
    'video',
    id,
    `${TIKTOK}/player/v1/${enc(id)}?rel=0`,
    `${TIKTOK}/@${enc(actor)}/video/${enc(id)}`,
    'portrait',
  )
}

/** `/<handle>/status/<id>` (also `statuses`, `/i/web/status/<id>`), on twitter.com or x.com. */
function parseX(seg: string[]): ParsedEmbed | null {
  let actor: string | null = null
  let id: string | null = null
  if (seg[0] === 'i') {
    const at = seg.indexOf('status')
    id = at > 0 ? valid(seg[at + 1], /^[0-9]{1,20}$/) : null
  } else if (seg[1] === 'status' || seg[1] === 'statuses') {
    actor = valid(seg[0], X_ACTOR)
    id = valid(seg[2], /^[0-9]{1,20}$/)
    if (!actor) return null
  }
  if (!id) return null
  return embed(
    'x',
    'post',
    id,
    `${X_EMBED}/embed/Tweet.html?id=${enc(id)}&dnt=true&lang=fr`,
    actor ? `https://x.com/${enc(actor)}/status/${enc(id)}` : `https://x.com/i/status/${enc(id)}`,
    'post',
    { heightOrigin: X_EMBED, initialHeight: 560 },
  )
}

function parseEmbedAt(input: string, depth: number): ParsedEmbed | null {
  const url = parseUrl(input)
  if (!url) return null
  const host = hostOf(url)
  const seg = segmentsOf(url)
  if (hostMatches(host, ['youtube.com', 'youtu.be', 'youtube-nocookie.com'])) return parseYouTube(url, host, seg)
  if (hostMatches(host, ['vimeo.com'])) return parseVimeo(url, host, seg)
  if (hostMatches(host, ['dailymotion.com', 'dai.ly'])) return parseDailymotion(host, seg)
  if (hostMatches(host, ['facebook.com', 'fb.watch'])) return parseFacebook(url, host, seg, depth)
  if (hostMatches(host, ['instagram.com', 'instagr.am'])) return parseInstagram(seg)
  if (hostMatches(host, ['tiktok.com'])) return parseTikTok(host, seg)
  if (hostMatches(host, ['twitter.com', 'x.com'])) return parseX(seg)
  return null
}

/**
 * Parse a pasted link. `null` is the only failure mode — never throws, never a partial result —
 * so a non-null `embedSrc` is safe to put in an `src`.
 */
export function parseEmbed(input: string): ParsedEmbed | null {
  return parseEmbedAt(input, 0)
}

/**
 * Why a link cannot be used, in the journalist's words — the block validator's message and the
 * admin preview's warning. Short links get their own instruction: they hide the id, and only
 * opening them reveals it.
 */
export function embedRefusal(input: string): string {
  const url = parseUrl(input)
  const host = url ? hostOf(url) : ''
  if (
    hostMatches(host, ['vm.tiktok.com', 'vt.tiktok.com']) ||
    (hostMatches(host, ['tiktok.com']) && segmentsOf(url as URL)[0] === 't')
  ) {
    return 'Ce lien TikTok raccourci ne contient pas la vidéo : ouvrez-le dans votre navigateur, puis copiez l’adresse complète (tiktok.com/@compte/video/…).'
  }
  if (hostMatches(host, ['facebook.com']) && segmentsOf(url as URL)[0] === 'share') {
    return 'Ce lien de partage Facebook ne contient pas la vidéo : ouvrez-le dans votre navigateur, puis copiez l’adresse complète (facebook.com/…/videos/… ou /reel/…).'
  }
  if (hostMatches(host, ['instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com'])) {
    return 'Ce lien mène à un profil ou à une page, pas à une publication : ouvrez la publication elle-même et copiez son adresse.'
  }
  return `Ce lien n’est pas reconnu. Collez le lien d’une vidéo ou d’une publication ${SUPPORTED_PLATFORMS_LABEL}, copié depuis la barre d’adresse.`
}

/**
 * The content height a provider frame reported in a `message` event, or null. Instagram sends
 * `{"type":"MEASURE","details":{"height":N}}` (a string), X sends
 * `{"twttr.embed":{"method":"twttr.private.resize","params":[{"height":N}]}}` (string or object) —
 * both measured 2026-11-24. The caller checks the event's origin and source window first.
 */
export function reportedHeight(provider: EmbedProvider, data: unknown): number | null {
  let value: unknown = data
  if (typeof value === 'string') {
    if (value.length > 20_000) return null
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object') return null
  let height: unknown
  if (provider === 'instagram') {
    const v = value as { type?: unknown; details?: { height?: unknown } }
    if (v.type === 'MEASURE') height = v.details?.height
  } else if (provider === 'x') {
    const v = (value as Record<string, unknown>)['twttr.embed'] as
      | { method?: unknown; params?: Array<{ height?: unknown }> }
      | undefined
    if (v?.method === 'twttr.private.resize') height = v.params?.[0]?.height
  }
  const n = typeof height === 'number' ? height : Number(height)
  return Number.isFinite(n) && n >= 80 && n <= 4000 ? Math.round(n) : null
}
