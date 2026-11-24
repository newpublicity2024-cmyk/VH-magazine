'use client'

import { useField } from '@payloadcms/ui'
import { useId, type ReactNode } from 'react'

import { GALLERY_LAYOUT_OPTIONS, type GalleryLayout } from '../../blocks/Gallery'

/**
 * The gallery's « Disposition » as six small drawings instead of a dropdown — a writer recognises
 * a mosaic faster than they read « Mosaïque ». Native radio buttons underneath, so arrow keys move
 * between layouts and a screen reader announces the group, the label and the hint. Stores the
 * same `select` value the field always had.
 */
const DRAWINGS: Record<GalleryLayout, ReactNode> = {
  grid: (
    <>
      <rect x="2" y="2" width="17" height="12" />
      <rect x="21" y="2" width="17" height="12" />
      <rect x="40" y="2" width="17" height="12" />
      <rect x="2" y="16" width="17" height="12" />
      <rect x="21" y="16" width="17" height="12" />
      <rect x="40" y="16" width="17" height="12" />
    </>
  ),
  mosaic: (
    <>
      <rect x="2" y="2" width="55" height="15" />
      <rect x="2" y="19" width="17" height="9" />
      <rect x="21" y="19" width="17" height="9" />
      <rect x="40" y="19" width="17" height="9" />
    </>
  ),
  masonry: (
    <>
      <rect x="2" y="2" width="17" height="15" />
      <rect x="2" y="19" width="17" height="9" />
      <rect x="21" y="2" width="17" height="8" />
      <rect x="21" y="12" width="17" height="16" />
      <rect x="40" y="2" width="17" height="12" />
      <rect x="40" y="16" width="17" height="12" />
    </>
  ),
  row: (
    <>
      <rect x="2" y="2" width="24" height="12" />
      <rect x="28" y="2" width="10" height="12" />
      <rect x="40" y="2" width="17" height="12" />
      <rect x="2" y="16" width="13" height="12" />
      <rect x="17" y="16" width="40" height="12" />
    </>
  ),
  stack: (
    <>
      <rect x="10" y="2" width="39" height="12" />
      <rect x="10" y="16" width="39" height="12" />
    </>
  ),
  carousel: (
    <>
      <rect x="10" y="2" width="39" height="21" />
      <path d="M6 9l-3 3.5 3 3.5M53 9l3 3.5-3 3.5" fill="none" />
      <circle cx="25" cy="27" r="1.3" />
      <circle cx="29.5" cy="27" r="1.3" className="vhb-layouts__dim" />
      <circle cx="34" cy="27" r="1.3" className="vhb-layouts__dim" />
    </>
  ),
}

export function GalleryLayoutField({
  path,
  readOnly,
}: {
  path?: string
  readOnly?: boolean
}) {
  const { value, setValue } = useField<string>({ potentiallyStalePath: path })
  // Each gallery block is its own form, but their radios share one page: a per-instance name.
  const name = useId()
  const current = (value as GalleryLayout | undefined) ?? 'grid'

  return (
    <fieldset className="vhb-layouts" data-layout-picker>
      <legend className="vhb-layouts__legend">Disposition</legend>
      <div className="vhb-layouts__options">
        {GALLERY_LAYOUT_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="vhb-layouts__option"
            data-layout={option.value}
            data-checked={current === option.value}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={current === option.value}
              disabled={readOnly}
              onChange={() => setValue(option.value)}
            />
            <svg viewBox="0 0 59 30" aria-hidden="true" className="vhb-layouts__drawing">
              {DRAWINGS[option.value]}
            </svg>
            <span className="vhb-layouts__label">{option.label}</span>
            <span className="vhb-layouts__hint">{option.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
