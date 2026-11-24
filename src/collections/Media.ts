import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor, isAuthenticated } from '../access'
import { editorialOnly } from '../fields/visibility'

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
  labels: { singular: 'Média', plural: 'Médiathèque' },
  admin: {
    group: 'Rédaction',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'alt', 'credit', 'updatedAt'],
    hideAPIURL: true,
  },
  access: {
    read: anyone,
    create: isAuthenticated,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  upload: {
    // video/audio: the WordPress archive holds ~230 clips (MP4/MOV/MP3) that
    // articles embed. Payload only runs sharp on images, so these upload as-is.
    mimeTypes: ['image/*', 'application/pdf', 'video/*', 'audio/*'],
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
      admin: {
        description:
          'Décrivez la photo en une phrase, ex. « Le nouveau Range Rover Sport devant la Tour Hassan ». Lue aux lecteurs malvoyants et par Google.',
      },
    },
    {
      name: 'credit',
      type: 'text',
      label: 'Crédit photo',
    },
    // ── WordPress migration (round 2b) ──────────────────────────────────────
    // Set only by the importer. legacyPath is the key the article import and
    // /api/legacy-media resolve old URLs through, so it is unique and indexed.
    {
      name: 'legacyPath',
      type: 'text',
      label: 'Chemin WordPress',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        condition: editorialOnly,
        description: 'Ancien chemin sur vh.ma, ex. wp-content/uploads/2024/03/photo.jpg',
      },
    },
    {
      name: 'legacyWpId',
      type: 'number',
      label: 'ID WordPress',
      index: true,
      admin: { readOnly: true, position: 'sidebar', condition: editorialOnly },
    },
  ],
}
