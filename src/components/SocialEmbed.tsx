import { EmbedFrame } from '@/components/EmbedFrame'
import { VideoEmbed } from '@/components/VideoEmbed'
import { KIND_LABELS, PROVIDER_LABELS, parseEmbed } from '@/lib/embeds'
import { typoFr } from '@/lib/typo-fr'
import { videoId } from '@/lib/youtube'

/**
 * The « Vidéo ou publication » block on the public page (blocks/VideoEmbed.ts).
 *
 * - YouTube: the click-to-load poster as before (spec §9). Without a caption the markup is
 *   exactly what the 755 archived blocks rendered before this block took other platforms.
 * - Vimeo, Facebook, Instagram, TikTok, X: the provider's own player in a lazy frame of its
 *   shape (`.vh-player--landscape|portrait|post`), since none has a poster we could show
 *   without its API. Under it, « Voir sur … » — the way to the post if the frame fails (a deleted
 *   post, a blocked provider) and the only thing a reader without JavaScript gets for Instagram
 *   and X.
 * - Dailymotion: a card that opens the video there — its player refuses vh.ma (lib/embeds).
 */
export function SocialEmbed({ url, caption }: { url: string; caption?: string | null }) {
  const text = typeof caption === 'string' && caption.trim() ? caption.trim() : null
  const parsed = parseEmbed(url)

  if (videoId(url) || parsed?.provider === 'youtube') {
    // The legacy rule first, so an archived link keeps the exact id it always played.
    const playable = videoId(url) ? url : (parsed?.canonicalUrl ?? url)
    const facade = <VideoEmbed url={playable} title={text ?? undefined} />
    if (!text) return facade
    return (
      <figure data-embed data-provider="youtube" className="vh-player vh-player--landscape">
        {facade}
        <figcaption>{typoFr(text)}</figcaption>
      </figure>
    )
  }
  if (!parsed) return null

  const provider = PROVIDER_LABELS[parsed.provider]
  if (!parsed.embedSrc) {
    return (
      <figure data-embed data-provider={parsed.provider} className="vh-player vh-player--card">
        <a
          href={parsed.canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="vh-embed"
          data-embed-link
        >
          <span className="type-copy-sm min-w-0 truncate">{text ? typoFr(text) : `Vidéo ${provider}`}</span>
          <span className="type-button vh-embed__action shrink-0">Regarder sur {provider} ›</span>
        </a>
      </figure>
    )
  }

  const kind = KIND_LABELS[parsed.kind]
  const title = `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${provider}${text ? ` : ${text}` : ''}`
  return (
    <figure
      data-embed
      data-provider={parsed.provider}
      data-kind={parsed.kind}
      data-shape={parsed.shape}
      className={`vh-player vh-player--${parsed.shape} vh-player--${parsed.provider}`}
    >
      <div className="vh-player__frame">
        <EmbedFrame
          src={parsed.embedSrc}
          title={title}
          provider={parsed.provider}
          heightOrigin={parsed.heightOrigin}
          initialHeight={parsed.shape === 'post' ? parsed.initialHeight : 0}
        />
      </div>
      <figcaption className="vh-player__caption">
        {text ? <span>{typoFr(text)}</span> : null}
        <a href={parsed.canonicalUrl} target="_blank" rel="noopener noreferrer" data-embed-source>
          Voir sur {provider}
        </a>
      </figcaption>
    </figure>
  )
}
