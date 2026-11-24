import {
  AlignFeature,
  BlockquoteFeature,
  BlocksFeature,
  BoldFeature,
  EXPERIMENTAL_TableFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  StrikethroughFeature,
  UnderlineFeature,
  UnorderedListFeature,
  UploadFeature,
  createServerFeature,
} from '@payloadcms/richtext-lexical'

import { GalleryBlock } from '../blocks/Gallery'
import { VideoEmbedBlock } from '../blocks/VideoEmbed'

/**
 * The article editor's Lexical features, in one importable place (lallafatema's pattern).
 *
 * A module rather than an inline array in payload.config.ts so that "which tools does a
 * journalist have?" can be answered by importing this function without booting Payload — gate
 * BO-G6 reads each feature's key. Every node type these features can produce has a renderer in
 * `RichTextBody` (gate BO-G7 publishes one of each and reads the public page).
 *
 * Deliberate choices:
 * - Headings start at h2: the article title is the page's only h1 (spec §9, gate G36).
 * - `UploadFeature` is load-bearing: migrated bodies hold upload nodes (images, the archive's
 *   MP4/MP3 files), and removing the feature would leave them unrenderable in the editor.
 * - `AlignFeature` dispatches left/centre/right/justify. The site applies centre and right;
 *   justify is stored but not applied, because Word pastes arrive justified and vh.ma body
 *   copy is ragged-right (RichTextBody).
 * - Both toolbars: the fixed bar is always visible, the inline one follows a selection and is
 *   the only one on narrow screens.
 * - Undo/redo are Lexical core (Ctrl/⌘+Z), not features.
 */
export function articleFeatures() {
  return [
    ParagraphFeature(),
    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
    StrikethroughFeature(),
    AlignFeature(),
    LinkFeature(),
    UnorderedListFeature(),
    OrderedListFeature(),
    BlockquoteFeature(),
    HorizontalRuleFeature(),
    // Payload still ships tables as experimental (feature key `experimental_table`). Moteur's
    // spec sheets are the use: a screenshot of a table is worse for every reader.
    EXPERIMENTAL_TableFeature(),
    UploadFeature(),
    BlocksFeature({ blocks: [VideoEmbedBlock, GalleryBlock] }),
    LinkPasteFeature(),
    FixedToolbarFeature(),
    InlineToolbarFeature(),
  ]
}

type LinkPasteClientProps = { videoBlockSlug: string }

/**
 * Paste a video or social-post link (YouTube, Instagram, TikTok, X…) on an empty line and get
 * the « Vidéo ou publication » block, not a bare link.
 *
 * The half of lallafatema's smart paste that ports as-is. The other half — dropping image
 * files into the text — uploads through Payload's server multipart path, which Vercel cuts
 * at 4.5 MB (VH uploads straight to Blob for that reason); it stays out until it can use
 * the client-upload path.
 *
 * The block slug travels as a client prop from the block config itself, so a rename cannot
 * leave the plugin inserting blocks the editor does not know. `dependencies` makes Payload
 * refuse to boot if the blocks feature is removed, instead of failing at paste time.
 */
export const LinkPasteFeature = createServerFeature<undefined, undefined, LinkPasteClientProps>({
  dependencies: ['blocks'],
  feature: {
    ClientFeature: '/backoffice/editor/LinkPasteFeature#LinkPasteFeatureClient',
    clientFeatureProps: { videoBlockSlug: VideoEmbedBlock.slug },
  },
  key: 'vhLinkPaste',
})
