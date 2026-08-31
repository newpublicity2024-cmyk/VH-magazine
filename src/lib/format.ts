/**
 * Date formatting for VH.
 *
 * Spec §3 fixes the display format at DD/MM/YYYY. Formatted manually from the
 * UTC parts rather than with Intl: the server and the reader's browser can sit
 * in different time zones, and a locale-aware formatter would render a
 * different day on each side, producing a hydration mismatch on an article
 * published near midnight.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getUTCFullYear()}`
}

/** The machine-readable counterpart for <time dateTime>. */
export function isoDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}
