/**
 * The newsroom's review workflow, as pure data and functions.
 *
 * Shared by the Articles hooks (server), the admin components (client) and the gate
 * verifiers, so it must not import Payload's runtime or anything server-only (lib/embeds is pure).
 *
 * WordPress gives a Contributor « Soumettre pour relecture » instead of « Publier », and the
 * post then waits in the « En attente de relecture » list for an editor. VH keeps exactly
 * that model: a journalist cannot publish (Articles.beforeChange forces their saves to draft)
 * and instead sets `reviewState: 'pending'`. The flag is written by a DRAFT save, so it lives
 * on the article's latest VERSION — anything that reads it must query with `draft: true`
 * (Payload's `count` cannot; use `find` and read `totalDocs`).
 */

import { embedRefusal, parseEmbed } from './embeds'

export const REVIEW_STATES = ['none', 'pending'] as const
export type ReviewState = (typeof REVIEW_STATES)[number]

export const REVIEW_LABELS: Record<ReviewState, string> = {
  none: '—',
  pending: 'En attente de relecture',
}

type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
  fields?: { blockType?: unknown; url?: unknown }
}

/** Every text run of a Lexical document, joined and whitespace-collapsed. */
export function lexicalPlainText(value: unknown): string {
  const root = (value as { root?: LexicalNode } | null | undefined)?.root
  if (!root) return ''
  const parts: string[] = []
  const walk = (node: LexicalNode | undefined): void => {
    if (!node) return
    if (typeof node.text === 'string') parts.push(node.text)
    for (const child of node.children ?? []) walk(child)
  }
  walk(root)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/** True when a Lexical document holds a non-text node a reader would see (image, video, gallery…). */
export function lexicalHasMedia(value: unknown): boolean {
  const root = (value as { root?: LexicalNode } | null | undefined)?.root
  let found = false
  const walk = (node: LexicalNode | undefined): void => {
    if (!node || found) return
    if (node.type === 'upload' || node.type === 'block') {
      found = true
      return
    }
    for (const child of node.children ?? []) walk(child)
  }
  walk(root)
  return found
}

/**
 * The « Vidéo ou publication » links of a document that no platform can play. Payload validates
 * blocks only on a non-draft save, and a journalist only ever saves drafts, so without this a bad
 * link would surface at the editor's Publish instead of the writer's « Soumettre ».
 */
export function unplayableLinks(value: unknown): string[] {
  const root = (value as { root?: LexicalNode } | null | undefined)?.root
  const bad: string[] = []
  const walk = (node: LexicalNode | undefined): void => {
    if (!node) return
    if (node.type === 'block' && node.fields?.blockType === 'videoEmbed') {
      const url = typeof node.fields.url === 'string' ? node.fields.url.trim() : ''
      if (!parseEmbed(url)) bad.push(url)
    }
    for (const child of node.children ?? []) walk(child)
  }
  walk(root)
  return bad
}

export const wordCount = (text: string): number => (text ? text.split(' ').length : 0)

/** A relationship value from a form or a doc: an id, a populated object, or nothing. */
const hasRef = (value: unknown): boolean =>
  value !== null &&
  value !== undefined &&
  value !== '' &&
  !(typeof value === 'object' && !('id' in (value as object)))

export type ReviewInput = {
  title?: unknown
  category?: unknown
  featuredImage?: unknown
  body?: unknown
}

export type MissingField = {
  path: 'title' | 'category' | 'featuredImage' | 'body'
  /** The checklist line it unticks (`links` is a body error with its own line). */
  check: 'title' | 'category' | 'featuredImage' | 'body' | 'links'
  message: string
}

/**
 * What an article still lacks before an editor can publish it — the same four things the
 * editor's own Publish would refuse (title, rubric, cover image) plus a body, which Payload
 * does not require but an article without text is not one.
 *
 * Used twice with one meaning: the sidebar checklist ticks these off live, and the server
 * refuses « Soumettre pour relecture » with exactly these field errors. A link block no platform
 * can play counts too: it would be an empty frame in the published article.
 */
export function missingForReview(data: ReviewInput): MissingField[] {
  const missing: MissingField[] = []
  if (typeof data.title !== 'string' || data.title.trim() === '') {
    missing.push({ path: 'title', check: 'title', message: 'Ajoutez un titre avant de soumettre l’article.' })
  }
  if (!hasRef(data.category)) {
    missing.push({ path: 'category', check: 'category', message: 'Choisissez la rubrique de l’article.' })
  }
  if (!hasRef(data.featuredImage)) {
    missing.push({ path: 'featuredImage', check: 'featuredImage', message: 'Ajoutez l’image à la une.' })
  }
  if (lexicalPlainText(data.body) === '' && !lexicalHasMedia(data.body)) {
    missing.push({ path: 'body', check: 'body', message: 'Écrivez le texte de l’article.' })
  }
  for (const url of unplayableLinks(data.body)) {
    missing.push({
      path: 'body',
      check: 'links',
      message: url
        ? `Lien de vidéo ou de publication non reconnu (${url.slice(0, 80)}) : ${embedRefusal(url)}`
        : 'Un bloc « Vidéo ou publication » n’a pas de lien.',
    })
  }
  return missing
}
