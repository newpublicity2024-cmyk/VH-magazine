'use client'

import { useEffect } from 'react'

/**
 * Fire-and-forget view counter (spec §6 step 6).
 *
 * Deduped per reader per article in sessionStorage, so a re-render, a
 * back-navigation or a React strict-mode double-effect cannot inflate the
 * count. The server rate-limits per IP+article as well — client-side dedupe
 * alone is trivially bypassed and would make "Les plus lus" a popularity
 * contest between bots.
 *
 * Renders nothing; failures are swallowed because a view count is never worth
 * showing a reader an error over.
 */
export function ViewCounter({ articleId }: { articleId: number }) {
  useEffect(() => {
    const key = `vh-viewed-${articleId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // Private mode or storage disabled: still count it, just without dedupe.
    }

    const controller = new AbortController()
    fetch('/api/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ articleId }),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => {})

    return () => controller.abort()
  }, [articleId])

  return null
}
