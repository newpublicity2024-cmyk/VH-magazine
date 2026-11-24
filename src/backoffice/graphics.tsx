/**
 * Admin graphics (`admin.components.graphics`): the VH wordmark on the login card and the
 * compact mark in the dark admin bar.
 *
 * Both reference the public files by path, so when VH's official SVGs replace the round-3
 * placeholders in public/ (gate R3-G3), the back office follows with no code change.
 * Plain <img>: these are static SVGs on Payload's own pages, outside next/image's reach.
 */

export function Logo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="vhb-logo" src="/vh-logo.svg" alt="VH Magazine" width={236} height={64} />
}

export function Icon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="vhb-mark" src="/vh-mark-white.svg" alt="VH Magazine" width={33} height={18} />
  )
}
