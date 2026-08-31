import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { VideoEmbed } from '@/components/VideoEmbed'

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
  let out: ReactNode = node.text ?? ''
  const f = typeof node.format === 'number' ? node.format : 0
  if (f & BOLD) out = <strong>{out}</strong>
  if (f & ITALIC) out = <em>{out}</em>
  if (f & UNDERLINE) out = <u>{out}</u>
  return <span key={key}>{out}</span>
}

function renderChildren(children: Node[] | undefined, prefix: string): ReactNode[] {
  return (children ?? []).map((child, i) => renderNode(child, `${prefix}-${i}`))
}

function renderNode(node: Node, key: string): ReactNode {
  if (!node) return null
  if (node.type === 'text') return renderText(node, key)

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
      const v = node.value as { url?: string; alt?: string; width?: number; height?: number } | undefined
      if (!v?.url) return null
      return (
        <Image
          key={key}
          src={v.url}
          alt={v.alt || ''}
          width={v.width || 1280}
          height={v.height || 720}
          sizes="(min-width: 1024px) 720px, 100vw"
          loading="lazy"
          className="h-auto w-full"
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
  return <div data-article-body className="vh-prose">{renderChildren(root.children, 'n')}</div>
}
