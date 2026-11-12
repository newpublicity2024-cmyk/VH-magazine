import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { VideoEmbed } from '@/components/VideoEmbed'
import { typoFr } from '@/lib/typo-fr'

/**
 * Render a Lexical document to React.
 *
 * Deliberately a hand-written walker rather than Payload's HTML converter: the
 * body must emit next/image for uploads (spec §9 wants explicit dimensions and
 * the optimizer) and a click-to-load facade for video, neither of which a
 * generic HTML serialiser produces. Unknown node types render their children
 * rather than throwing, so a future editor feature degrades to plain text
 * instead of blanking the article.
 */

type Node = {
  type?: string
  tag?: string
  text?: string
  format?: number | string
  children?: Node[]
  fields?: Record<string, unknown>
  value?: Record<string, unknown>
  url?: string
  listType?: string
  [k: string]: unknown
}

// Lexical text format is a bitmask.
const BOLD = 1
const ITALIC = 1 << 1
const UNDERLINE = 1 << 3

function renderText(node: Node, key: string): ReactNode {
  let out: ReactNode = typoFr(node.text ?? '')
  const f = typeof node.format === 'number' ? node.format : 0
  if (f & BOLD) out = <strong>{out}</strong>
  if (f & ITALIC) out = <em>{out}</em>
  if (f & UNDERLINE) out = <u>{out}</u>
  return <span key={key}>{out}</span>
}

function renderChildren(children: Node[] | undefined, prefix: string): ReactNode[] {
  return (children ?? []).map((child, i) => renderNode(child, `${prefix}-${i}`))
}

/**
 * A paragraph that is nothing but a link to a social post (a WordPress oEmbed that never
 * rendered after migration) — returns that URL, else null.
 */
const SOCIAL = /^(?:www\.)?(instagram\.com|facebook\.com|fb\.watch|twitter\.com|x\.com|tiktok\.com|linkedin\.com)$/i
function embedUrl(node: Node): string | null {
  const kids = (node.children ?? []).filter((k) => !(k.type === 'text' && !String(k.text ?? '').trim()))
  if (kids.length !== 1) return null
  const only = kids[0]
  const raw =
    only.type === 'link'
      ? String((only.fields as { url?: string })?.url ?? only.url ?? '')
      : only.type === 'text'
        ? String(only.text ?? '').trim()
        : ''
  if (!/^https?:\/\/\S+$/i.test(raw)) return null
  if (only.type === 'link') {
    const text = (only.children ?? []).map((c) => c.text ?? '').join('').trim()
    if (text && text !== raw && !/^https?:\/\//i.test(text)) return null
  }
  try {
    return SOCIAL.test(new URL(raw).hostname) ? raw : null
  } catch {
    return null
  }
}

function renderNode(node: Node, key: string): ReactNode {
  if (!node) return null
  if (node.type === 'text') return renderText(node, key)
  if (node.type === 'paragraph') {
    const url = embedUrl(node)
    if (url) {
      const host = new URL(url).hostname.replace(/^www\./, '')
      return (
        <p key={key}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="vh-embed">
            <span className="type-copy-sm min-w-0 truncate">Publication {host}</span>
            <span className="type-button shrink-0 text-accent">Voir la publication ›</span>
          </a>
        </p>
      )
    }
  }

  const kids = renderChildren(node.children, key)

  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{kids}</p>
    case 'heading': {
      // h1 is reserved for the article title — a body heading must never
      // introduce a second one (spec §9, gate G36).
      const tag = node.tag === 'h2' || node.tag === 'h3' ? node.tag : 'h3'
      const H = tag as 'h2' | 'h3'
      return <H key={key}>{kids}</H>
    }
    case 'quote':
      return <blockquote key={key}>{kids}</blockquote>
    case 'list':
      return node.listType === 'number' ? <ol key={key}>{kids}</ol> : <ul key={key}>{kids}</ul>
    case 'listitem':
      return <li key={key}>{kids}</li>
    case 'horizontalrule':
      return <hr key={key} />
    case 'linebreak':
      return <br key={key} />
    case 'link': {
      const url = String((node.fields as { url?: string })?.url ?? node.url ?? '#')
      const external = /^https?:\/\//i.test(url)
      return (
        <Link
          key={key}
          href={url}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {kids}
        </Link>
      )
    }
    case 'upload': {
      const v = node.value as
        | { url?: string; alt?: string; width?: number; height?: number; mimeType?: string }
        | undefined
      if (!v?.url) return null
      // Uploaded MP4/MP3 files (migrated WordPress <video>/<audio> players) play
      // natively; only the metadata loads until the reader presses play.
      if (v.mimeType?.startsWith('video/')) {
        return (
          <video
            key={key}
            src={v.url}
            controls
            preload="metadata"
            playsInline
            className="h-auto w-full"
          >
            <a href={v.url}>{v.alt || 'Vidéo'}</a>
          </video>
        )
      }
      if (v.mimeType?.startsWith('audio/')) {
        return (
          <audio key={key} src={v.url} controls preload="metadata" className="w-full">
            <a href={v.url}>{v.alt || 'Audio'}</a>
          </audio>
        )
      }
      return (
        <Image
          key={key}
          src={v.url}
          alt={v.alt || ''}
          width={v.width || 1280}
          height={v.height || 720}
          sizes="(min-width: 1024px) 720px, 100vw"
          loading="lazy"
          data-fade
          className="h-auto w-full bg-canvas-2"
        />
      )
    }
    case 'block': {
      const fields = node.fields as { blockType?: string; url?: string } | undefined
      if (fields?.blockType === 'videoEmbed' && fields.url) {
        return <VideoEmbed key={key} url={fields.url} />
      }
      return <div key={key}>{kids}</div>
    }
    default:
      return kids.length ? <div key={key}>{kids}</div> : null
  }
}

export function RichTextBody({ data }: { data: unknown }) {
  const root = (data as { root?: Node } | null)?.root
  if (!root?.children?.length) return null
  return (
    <div data-article-body className="vh-prose">
      {renderChildren(root.children, 'n')}
    </div>
  )
}
