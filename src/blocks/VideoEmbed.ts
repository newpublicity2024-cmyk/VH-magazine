import type { Block } from 'payload'

import { videoId } from '../lib/youtube'

/**
 * A YouTube video inside an article body. RichTextBody renders it as the
 * click-to-load facade (spec §9); the migrated WordPress articles carry their
 * in-text YouTube embeds as this block (round 2b).
 */
export const VideoEmbedBlock: Block = {
  slug: 'videoEmbed',
  labels: { singular: 'Vidéo YouTube', plural: 'Vidéos YouTube' },
  fields: [
    {
      name: 'url',
      type: 'text',
      label: 'URL YouTube',
      required: true,
      validate: (value: string | string[] | null | undefined) => {
        const url = Array.isArray(value) ? value[0] : value
        if (!url) return 'L’URL de la vidéo est obligatoire.'
        return videoId(url)
          ? true
          : 'Une URL YouTube est attendue (youtube.com/watch?v=…, youtu.be/…).'
      },
    },
  ],
}
