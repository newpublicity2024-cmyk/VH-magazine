'use client'

import {
  Button,
  useBulkUpload,
  useForm,
  useFormFields,
  useListDrawer,
  useModal,
} from '@payloadcms/ui'
import { useCallback, useRef } from 'react'

/**
 * « Ajouter des photos » above the gallery's rows — WordPress's « Ajouter à la galerie »: pick
 * several photos in the Médiathèque at once (its list drawer with row selection), or drop several
 * new files into Payload's own bulk-upload drawer. Either way each photo becomes a row of the
 * `images` array, after the existing ones, with an empty caption to fill in. The array's own
 * « Ajouter Photo » still adds one empty row.
 *
 * Rows go through the form's `addFieldRow`, as the array's button does, with the `image`
 * sub-field preset — so the rows validate, reorder and autosave like hand-made ones.
 */
export function GalleryBulkAdd({ path, schemaPath }: { path?: string; schemaPath?: string }) {
  const imagesPath = (path ?? 'addPhotos').replace(/addPhotos$/, 'images')
  const imagesSchemaPath = (schemaPath ?? '').replace(/addPhotos$/, 'images')
  const { addFieldRow, setModified } = useForm()
  const rowCount = useFormFields(([fields]) => {
    const state = fields?.[imagesPath]
    return Array.isArray(state?.rows) ? state.rows.length : Number(state?.value) || 0
  })

  const append = useCallback(
    (ids: Array<number | string>) => {
      ids.forEach((id, k) => {
        addFieldRow({
          path: imagesPath,
          rowIndex: rowCount + k,
          schemaPath: imagesSchemaPath,
          subFieldState: {
            image: { initialValue: id, value: id, valid: true },
            caption: { initialValue: '', value: '', valid: true },
          },
        })
      })
      if (ids.length) setModified(true)
    },
    [addFieldRow, imagesPath, imagesSchemaPath, rowCount, setModified],
  )

  const [ListDrawer, , { closeDrawer, openDrawer }] = useListDrawer({
    collectionSlugs: ['media'],
    uploads: true,
  })

  const { openModal } = useModal()
  const { drawerSlug, setCollectionSlug, setInitialFiles, setOnSuccess } = useBulkUpload()
  const fileInput = useRef<HTMLInputElement>(null)

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return
    setCollectionSlug('media')
    setInitialFiles(files)
    setOnSuccess((uploaded) => append(uploaded.map((u) => u.doc.id as number | string)))
    openModal(drawerSlug)
  }

  return (
    <div className="vhb-bulkadd" data-gallery-bulkadd>
      <p className="vhb-bulkadd__title">Ajouter des photos</p>
      <div className="vhb-bulkadd__actions">
        <Button buttonStyle="secondary" size="small" onClick={openDrawer} id="gallery-pick-many">
          Choisir plusieurs photos dans la médiathèque
        </Button>
        <Button
          buttonStyle="secondary"
          size="small"
          onClick={() => fileInput.current?.click()}
          id="gallery-upload-many"
        >
          Téléverser des photos
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          data-gallery-files
          onChange={(event) => {
            onFiles(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />
      </div>
      <p className="vhb-bulkadd__hint">
        Cochez autant de photos que vous voulez : chacune devient une ligne ci-dessous, dans
        l’ordre, avec sa légende à écrire.
      </p>
      <ListDrawer
        allowCreate={false}
        enableRowSelections
        onBulkSelect={(selected) => {
          const ids = [...selected].filter(([, on]) => on).map(([id]) => id as number | string)
          append(ids)
          closeDrawer()
        }}
        onSelect={({ doc }) => {
          append([doc.id as number | string])
          closeDrawer()
        }}
      />
    </div>
  )
}
