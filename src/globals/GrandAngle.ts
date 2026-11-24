import type { GlobalConfig } from 'payload'

import { anyone, isAdminOrEditor } from '../access'
import { revalidateGlobalAfterChange } from '../hooks/revalidate'

/**
 * The Grand Angle page (/vh-grand-angle-2/, primary nav). On vh.ma it is a hand-arranged page —
 * a curated run of dossiers, not the category's latest posts — so it is curated here too, in
 * order. Left empty, the page lists the grand-angle category, newest first.
 */
export const GrandAngle: GlobalConfig = {
  slug: 'grand-angle',
  label: 'Page Grand Angle',
  admin: { group: 'Contenu' },
  access: { read: anyone, update: isAdminOrEditor },
  hooks: { afterChange: [revalidateGlobalAfterChange] },
  fields: [
    {
      name: 'dossiers',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      label: 'Dossiers',
      admin: {
        description:
          'Dans l’ordre d’affichage. Vide : la page liste la rubrique Grand Angle, les plus récents d’abord.',
      },
    },
  ],
}
