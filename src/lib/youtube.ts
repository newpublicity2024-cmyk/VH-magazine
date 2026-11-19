/**
 * The YouTube URL shapes the site can play. Shared by the click-to-load facade
 * (components/VideoEmbed) and the editor's videoEmbed block validator
 * (blocks/VideoEmbed), so the editor can never store a URL the page cannot play.
 */
export const YOUTUBE_ID_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/

export function videoId(url: string): string | null {
  const m = YOUTUBE_ID_RE.exec(url)
  return m ? m[1] : null
}
