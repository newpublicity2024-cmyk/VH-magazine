import type { Block } from 'payload'

/**
 * A photo gallery placed between paragraphs (« Galerie photos »).
 *
 * A Lexical block rather than a collection field: it lives inside the `body` JSON, so it needs
 * no migration, and a gallery is part of the article's flow — the writer decides where the
 * photos interrupt the text. Ported from lallafatema's block of the same slug and widened to
 * the six ways a magazine shows a set of photos (components/Gallery renders each):
 *
 * - `grid` — equal tiles, cropped alike; `mosaic` — the first photo large, the others under it;
 * - `masonry` — columns that keep each photo's proportions; `row` — side by side, one height per
 *   row, each photo uncropped; `stack` — each photo the full width of the text, one under another
 *   (the photo-essay); `carousel` — one photo at a time, with arrows, swipe and a counter.
 *
 * The stored values (layout, columns) are an interface the public renderer reads, so they stay
 * English while every label is French. No article stores this block yet: the archive's WordPress
 * galleries became runs of images (migration tools/wp-lexical.mjs).
 */
export const GALLERY_LAYOUTS = ['grid', 'mosaic', 'masonry', 'row', 'stack', 'carousel'] as const

export type GalleryLayout = (typeof GALLERY_LAYOUTS)[number]

/** The layouts whose column count the writer chooses (for `row`, photos per row). */
export const LAYOUTS_WITH_COLUMNS: readonly GalleryLayout[] = ['grid', 'masonry', 'row']

export const GALLERY_LAYOUT_OPTIONS: { value: GalleryLayout; label: string; hint: string }[] = [
  { value: 'grid', label: 'Grille', hint: 'Photos de même taille, recadrées pareil.' },
  { value: 'mosaic', label: 'Mosaïque', hint: 'La première en grand, les autres dessous.' },
  { value: 'masonry', label: 'Colonnes', hint: 'Chaque photo garde ses proportions.' },
  { value: 'row', label: 'Côte à côte', hint: 'Par rangées de même hauteur, sans recadrage.' },
  { value: 'stack', label: 'Pleine largeur', hint: 'Les photos l’une sous l’autre, en grand.' },
  { value: 'carousel', label: 'Diaporama', hint: 'Une photo à la fois, avec des flèches.' },
]

export const GalleryBlock: Block = {
  slug: 'gallery',
  interfaceName: 'GalleryBlock',
  labels: { singular: 'Galerie photos', plural: 'Galeries photos' },
  fields: [
    {
      name: 'layout',
      type: 'select',
      label: 'Disposition',
      required: true,
      defaultValue: 'grid',
      options: GALLERY_LAYOUT_OPTIONS.map(({ value, label }) => ({ value, label })),
      // Drawings of each layout instead of a dropdown (WordPress shows its gallery styles so).
      admin: { components: { Field: '/backoffice/editor/GalleryLayoutField#GalleryLayoutField' } },
    },
    {
      name: 'columns',
      type: 'select',
      label: 'Colonnes (photos par rangée)',
      defaultValue: 'auto',
      options: [
        { label: 'Automatique', value: 'auto' },
        { label: '2', value: '2' },
        { label: '3', value: '3' },
        { label: '4', value: '4' },
      ],
      admin: {
        condition: (_data, siblingData) =>
          LAYOUTS_WITH_COLUMNS.includes(siblingData?.layout as GalleryLayout),
        description: 'Automatique : 2 pour 2 ou 4 photos, 3 sinon. Sur téléphone, 2 au plus.',
      },
    },
    {
      // Stores nothing: « Choisir plusieurs photos » / « Téléverser des photos » add one row per
      // photo in a single step, where the array's own button adds one empty row at a time.
      name: 'addPhotos',
      type: 'ui',
      admin: { components: { Field: '/backoffice/editor/GalleryBulkAdd#GalleryBulkAdd' } },
    },
    {
      name: 'images',
      type: 'array',
      label: 'Photos',
      labels: { singular: 'Photo', plural: 'Photos' },
      // A gallery without a photo would render as a hole in the article.
      minRows: 1,
      required: true,
      admin: {
        description: 'Glissez les photos pour changer leur ordre : c’est l’ordre de l’article.',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'Photo',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
          label: 'Légende (facultatif)',
        },
      ],
    },
    {
      name: 'caption',
      type: 'text',
      label: 'Légende de la galerie (facultatif)',
    },
    {
      name: 'lightbox',
      type: 'checkbox',
      label: 'Agrandir les photos au clic',
      defaultValue: true,
    },
  ],
}
