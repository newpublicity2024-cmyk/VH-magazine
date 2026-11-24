import type { Block } from 'payload'

import { embedRefusal, parseEmbed, SUPPORTED_PLATFORMS_LABEL } from '../lib/embeds'

/**
 * « Vidéo ou publication »: a video or a social post, from its link, placed between paragraphs.
 *
 * One block for every platform, as WordPress's embed block is: the journalist pastes a link and
 * the site works out what it is (`lib/embeds`). RichTextBody renders YouTube as the click-to-load
 * poster (spec §9) and the others as lazy players (components/SocialEmbed).
 *
 * The slug, `videoEmbed`, and the `url` field are a stored contract: 755 blocks in the migrated
 * archive carry them (all YouTube `watch?v=` links, measured 2026-11-24), so this block may only
 * grow by addition. The validator is the strict parser alone: the original YouTube rule
 * (`videoId`) found an id anywhere in the text, so it accepted `notyoutube.com/watch?v=…`.
 * Gate BO-G20 runs this validator over every archived block — all still pass, same video.
 */
export const VideoEmbedBlock: Block = {
  slug: 'videoEmbed',
  interfaceName: 'VideoEmbedBlock',
  labels: { singular: 'Vidéo ou publication', plural: 'Vidéos et publications' },
  fields: [
    {
      name: 'url',
      type: 'text',
      label: 'Lien de la vidéo ou de la publication',
      required: true,
      admin: {
        placeholder: 'https://www.instagram.com/p/…',
        description: `${SUPPORTED_PLATFORMS_LABEL} : collez le lien copié depuis la barre d’adresse.`,
      },
      validate: (value: string | string[] | null | undefined) => {
        const url = (Array.isArray(value) ? value[0] : value)?.trim()
        if (!url) return 'Le lien de la vidéo ou de la publication est obligatoire.'
        if (parseEmbed(url)) return true
        return embedRefusal(url)
      },
    },
    {
      // Stores nothing: says which platform the link is, or why it is refused, and shows it.
      name: 'preview',
      type: 'ui',
      admin: { components: { Field: '/backoffice/editor/EmbedPreview#EmbedPreview' } },
    },
    {
      name: 'caption',
      type: 'text',
      label: 'Légende (facultatif)',
    },
  ],
}
