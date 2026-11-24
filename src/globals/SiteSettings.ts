import type { GlobalConfig } from 'payload'

import { anyone, hiddenFromJournalists, isAdminOrEditor } from '../access'
import { revalidateGlobalAfterChange } from '../hooks/revalidate'

/** Site-wide identity: socials, default OG image, the media kit PDF (spec §4.1, §9). */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Paramètres du site',
  admin: { group: 'Réglages', hideAPIURL: true, hidden: hiddenFromJournalists },
  access: { read: anyone, update: isAdminOrEditor },
  hooks: { afterChange: [revalidateGlobalAfterChange] },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nom du site',
      required: true,
      defaultValue: 'VH Magazine',
    },
    {
      name: 'tagline',
      type: 'text',
      label: 'Accroche',
      defaultValue: 'Art de vivre | Lifestyle | People | Mode | Homme',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description par défaut',
      defaultValue:
        'VH Magazine — le magazine masculin marocain : art de vivre, lifestyle, people, mode et moteur.',
    },
    {
      name: 'defaultOgImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Image de partage par défaut',
    },
    {
      name: 'mediaKit',
      type: 'upload',
      relationTo: 'media',
      label: 'Kit média (PDF)',
      admin: { description: 'Lié depuis la barre utilitaire.' },
    },
    {
      name: 'social',
      type: 'group',
      label: 'Réseaux sociaux',
      fields: [
        {
          name: 'facebook',
          type: 'text',
          defaultValue: 'https://www.facebook.com/VHMagazineMaroc',
        },
        { name: 'twitter', type: 'text', defaultValue: 'https://twitter.com/VH_Magazine' },
        { name: 'instagram', type: 'text', defaultValue: 'https://www.instagram.com/vh.magazine/' },
        { name: 'youtube', type: 'text', defaultValue: 'https://www.youtube.com/@VHMagazine' },
      ],
    },
  ],
}
