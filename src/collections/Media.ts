import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor, isAuthenticated } from '../access'

/**
 * Uploads. Files live on local disk in dev (./media) and in Vercel Blob once
 * BLOB_READ_WRITE_TOKEN is set — the DB only ever stores the reference.
 *
 * Unlike the sister sites, VH serves images through Next's own optimizer
 * (spec §9 wants AVIF/WebP + explicit dimensions and there is no CDN in front),
 * so `width`/`height` must be populated for every image. Payload fills them from
 * sharp on upload; the `imageSizes` below are the card variants from spec §6.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Média', plural: 'Médias' },
  admin: { group: 'Contenu', useAsTitle: 'filename' },
  access: {
    read: anyone,
    create: isAuthenticated,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  upload: {
    mimeTypes: ['image/*', 'application/pdf'],
    focalPoint: true,
    imageSizes: [
      { name: 'thumb', width: 160, height: 160, position: 'centre' },
      { name: 'card', width: 640, height: 360, position: 'centre' },
      { name: 'wide', width: 1280, height: 720, position: 'centre' },
      { name: 'cover', width: 480, height: 640, position: 'centre' },
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Texte alternatif',
      required: true,
      admin: { description: 'Décrit l’image pour les lecteurs d’écran et le référencement.' },
    },
    {
      name: 'credit',
      type: 'text',
      label: 'Crédit photo',
    },
  ],
}
