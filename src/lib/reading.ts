/**
 * Reading time for the article header (DESIGN-SPEC-R3 §5.2): words ÷ 230, at least one
 * minute. Counted from the Lexical text nodes on the server, so it costs no client JS.
 */
type LexicalNode = { type?: string; text?: string; children?: LexicalNode[] }

function countWords(node: LexicalNode | undefined): number {
  if (!node) return 0
  let n = node.type === 'text' && node.text ? node.text.split(/\s+/).filter(Boolean).length : 0
  for (const child of node.children ?? []) n += countWords(child)
  return n
}

export function readingMinutes(body: unknown, extra = ''): number {
  const root = (body as { root?: LexicalNode } | null)?.root
  const words = countWords(root) + extra.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 230))
}
