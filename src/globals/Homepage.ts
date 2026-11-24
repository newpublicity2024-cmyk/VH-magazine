import type { GlobalConfig } from 'payload'

import { anyone, hiddenFromJournalists, isAdminOrEditor } from '../access'
import { revalidateGlobalAfterChange } from '../hooks/revalidate'

/**
 * The hand-curated parts of the homepage.
 *
 * Most blocks (Actu, Lifestyle, Moteur, Vidéos, People, Les Unes) are automatic
 * — latest-N by category — so they need no configuration. These two are the
 * exceptions: "Chroniques cigare" is an editor's pick of five articles in a
 * deliberate order, and the dossier strips (spec §5.12) carry bespoke copy that
 * belongs to the homepage rather than to any one article.
 */
export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Page d’accueil',
  admin: { group: 'Mise en page', hideAPIURL: true, hidden: hiddenFromJournalists },
  access: { read: anyone, update: isAdminOrEditor },
  hooks: { afterChange: [revalidateGlobalAfterChange] },
  fields: [
    {
      name: 'chroniquesCigare',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      maxRows: 5,
      label: 'Chroniques cigare',
      admin: { description: 'Cinq articles, dans l’ordre d’affichage.' },
    },
    {
      name: 'dossiers',
      type: 'array',
      label: 'Dossiers',
      maxRows: 2,
      admin: { description: 'Deux bandeaux éditoriaux, empilés pleine largeur.' },
      fields: [
        { name: 'title', type: 'text', label: 'Titre', required: true },
        { name: 'body', type: 'textarea', label: 'Texte', required: true },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'Image',
          required: true,
        },
        { name: 'linkUrl', type: 'text', label: 'Lien', required: true },
        {
          name: 'linkLabel',
          type: 'text',
          label: 'Libellé du lien',
          defaultValue: 'Retrouvez ici l’intégralité du dossier',
        },
      ],
    },
  ],
}
