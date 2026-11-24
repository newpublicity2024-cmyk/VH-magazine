'use client'

import { useFormFields } from '@payloadcms/ui'

import {
  embedRefusal,
  KIND_LABELS,
  parseEmbed,
  PROVIDER_LABELS,
  type ParsedEmbed,
} from '../../lib/embeds'

/**
 * Under the link field of « Vidéo ou publication »: what the site understood, before saving.
 *
 * WordPress shows the embed as soon as a link is pasted, and that is the proof a journalist needs
 * that the link is the right one (a deleted post shows the provider's own « unavailable » card
 * here, not after publication). It reads the sibling `url` field of the same block form, parses
 * it with the renderer's own parser, and says one of four things: nothing pasted yet, refused
 * (and why — short links, profiles), Dailymotion (opens there), or the platform with its player.
 */
export function EmbedPreview({ path }: { path?: string }) {
  const urlPath = path && /preview$/.test(path) ? path.replace(/preview$/, 'url') : 'url'
  const url = useFormFields(([fields]) => {
    if (!fields) return ''
    // The block form's own path when Payload gave one; else its only `url` (lallafatema's rule).
    const key = urlPath in fields ? urlPath : Object.keys(fields).find((k) => k === 'url' || k.endsWith('.url'))
    const value = key ? fields[key]?.value : undefined
    return typeof value === 'string' ? value.trim() : ''
  })

  if (!url) {
    return (
      <p className="vhb-embed-preview vhb-embed-preview--empty" data-embed-preview="empty">
        Collez le lien : la vidéo ou la publication apparaîtra ici, comme sur le site.
      </p>
    )
  }

  const parsed: ParsedEmbed | null = parseEmbed(url)

  if (!parsed) {
    return (
      <div className="vhb-embed-preview vhb-embed-preview--refused" role="status" data-embed-preview="refused">
        <strong>Lien non reconnu</strong>
        <span>{embedRefusal(url)}</span>
      </div>
    )
  }

  const provider = PROVIDER_LABELS[parsed.provider]
  const kind = KIND_LABELS[parsed.kind]
  return (
    <div
      className="vhb-embed-preview"
      data-embed-preview={parsed.provider}
      data-embed-kind={parsed.kind}
    >
      <p className="vhb-embed-preview__head">
        <strong>
          {provider} · {kind}
        </strong>
        <a href={parsed.canonicalUrl} target="_blank" rel="noopener noreferrer">
          Ouvrir l’original ↗
        </a>
      </p>
      {parsed.embedSrc ? (
        <div className={`vhb-embed-preview__frame vhb-embed-preview__frame--${parsed.shape}`}>
          <iframe
            key={parsed.embedSrc}
            src={parsed.embedSrc}
            title={`Aperçu : ${kind} ${provider}`}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <p className="vhb-embed-preview__note">
          Dailymotion n’autorise pas la lecture de ses vidéos sur vh.ma : l’article affichera un
          lien « Regarder sur Dailymotion ».
        </p>
      )}
    </div>
  )
}
