'use client'

import type { PluginComponent } from '@payloadcms/richtext-lexical'

import { $createBlockNode, createClientFeature } from '@payloadcms/richtext-lexical/client'
import {
  $createParagraphNode,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  PASTE_COMMAND,
} from '@payloadcms/richtext-lexical/lexical'
import { useLexicalComposerContext } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext'
import { useEffect } from 'react'

import { parseEmbed } from '../../lib/embeds'

type LinkPasteProps = { videoBlockSlug: string }

/**
 * Turns a video or social-post link pasted on an EMPTY line into the « Vidéo ou publication »
 * block — YouTube, Vimeo, Dailymotion, Facebook, Instagram, TikTok, X (WordPress's auto-embed).
 *
 * Only an empty line converts: a link pasted into a sentence is meant as a link, and the link
 * feature handles it. Anything that is not exactly one link the block accepts (`parseEmbed`, the
 * block's own validator) is left to Lexical's paste.
 */
const LinkPastePlugin: PluginComponent<LinkPasteProps> = ({ clientProps }) => {
  const { videoBlockSlug } = clientProps
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const clipboard = (event as ClipboardEvent).clipboardData
          const text = clipboard?.getData('text/plain')?.trim() ?? ''
          if (!text || /\s/.test(text) || !parseEmbed(text)) return false
          // A clipboard carrying files is an image paste, not a link.
          if (clipboard && clipboard.files.length > 0) return false

          const selection = $getSelection()
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false
          const line = selection.anchor.getNode().getTopLevelElement()
          if (!line || !$isParagraphNode(line) || line.getTextContent().trim() !== '') return false

          ;(event as ClipboardEvent).preventDefault()
          const block = $createBlockNode({ blockName: '', blockType: videoBlockSlug, url: text })
          line.replace(block)
          if (block.getNextSibling() === null) block.insertAfter($createParagraphNode())
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    [editor, videoBlockSlug],
  )

  return null
}

export const LinkPasteFeatureClient = createClientFeature<LinkPasteProps>({
  plugins: [{ Component: LinkPastePlugin, position: 'normal' }],
})
