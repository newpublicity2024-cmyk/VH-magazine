/**
 * Security headers applied to every response (next.config.ts `headers()`).
 *
 * Deliberately no CSP here: the Payload admin ships inline styles and eval'd
 * chunks, and a policy loose enough to allow them buys nothing. A CSP scoped to
 * the `(frontend)` routes only is a step-7 task, once the embed surface
 * (YouTube, Instagram) is final.
 */
export function securityHeaders() {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    },
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
  ]
}
