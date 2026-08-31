import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor } from '../access'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

/**
 * Every promo slot on the homepage, keyed rather than hardcoded.
 *
 * Spec §5 has seven of these (collector, podcast, who's who, cool drives,
 * le luxe, the Unes banner, the sport collector). Making them editable documents
 * instead of literals in page.tsx means the editorial team can swap a campaign
 * without a deploy — which is the whole reason the site has a CMS.
 */
export const Banners: CollectionConfig = {
  slug: 'banners',
  labels: { singular: 'Bannière', plural: 'Bannières' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['key', 'title', 'active'],
    group: 'Contenu',
  },
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  fields: [
    {
      name: 'key',
      type: 'select',
      label: 'Emplacement',
      required: true,
      unique: true,
      index: true,
      options: [
        { label: 'Numéro collector (colonne latérale)', value: 'collector' },
        { label: 'The Shift Podcast (colonne latérale)', value: 'podcast' },
        { label: "Who's Who", value: 'whos-who' },
        { label: 'Un collector à ne pas manquer', value: 'collector-sport' },
        { label: 'Cool Drives by Rafik Lahlou', value: 'cool-drives' },
        { label: 'Le Luxe', value: 'le-luxe' },
        { label: 'Les Unes (bannière magazine)', value: 'unes' },
      ],
    },
    { name: 'title', type: 'text', label: 'Titre', required: true },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Image',
      required: true,
    },
    {
      name: 'linkUrl',
      type: 'text',
      label: 'Lien',
      required: true,
      admin: { description: 'Chemin interne (/le-luxe/) ou URL externe complète.' },
    },
    {
      name: 'body',
      type: 'textarea',
      label: 'Texte',
      admin: { description: 'Utilisé par les blocs qui affichent un paragraphe (Cool Drives).' },
    },
    {
      name: 'active',
      type: 'checkbox',
      label: 'Actif',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
  ],
}
