import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

import { blobBaseUrl } from './src/lib/legacy-media'
import { securityHeaders } from './src/lib/security-headers'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

/**
 * Blob stores the image optimizer may read. Next freezes `images` into the build
 * (.next/required-server-files.json), so the allow-list cannot wait for a runtime token: the
 * production store vh-magazine-media is pinned — its id is public, it is in every Blob URL —
 * and a store named by a build-time BLOB_READ_WRITE_TOKEN is added when it differs. A build
 * that cannot read the token therefore still serves every migrated image. GATES-LAUNCH L6
 * requests the real store (from the token file) on a token-less build, and a foreign store.
 */
const PRODUCTION_BLOB_HOST = 'uytqkgrnyabwhjzu.public.blob.vercel-storage.com'
const tokenBlobBase = process.env.BLOB_READ_WRITE_TOKEN ? blobBaseUrl() : null
const blobHosts = [...new Set([PRODUCTION_BLOB_HOST, tokenBlobBase && new URL(tokenBlobBase).hostname])].filter(
  (h): h is string => Boolean(h),
)

const nextConfig: NextConfig = {
  // SEO continuity: the live WordPress site serves every URL with a trailing
  // slash (/moteur/vh-moteur/porsche-.../). Canonicals in lib/seo.ts emit the
  // same form, so the served URL and the canonical can never disagree.
  trailingSlash: true,

  images: {
    // Unlike the sister repos, VH uses Next's own optimizer (spec §9 asks for
    // AVIF/WebP + explicit dimensions, and there is no Cloudflare in front).
    formats: ['image/avif', 'image/webp'],
    // Payload serves local-disk uploads from /api/media/file/<name> in dev.
    localPatterns: [{ pathname: '/api/media/file/**' }, { pathname: '/**' }],
    // Vercel Blob — THIS project's store only (blobHosts above). The wildcard
    // `*.public.blob.vercel-storage.com` let anyone point /_next/image at an image in any
    // Blob store and bill the transformation to us (GATES-LAUNCH L6 expects 400 for one).
    remotePatterns: [
      ...blobHosts.map((hostname) => ({ protocol: 'https' as const, hostname })),
      // YouTube poster frames for the click-to-load video facade.
      { protocol: 'https', hostname: 'i.ytimg.com' },
      // The legacy WordPress origin, during the validation window only (B1).
      // Host comes from MEDIA_ORIGIN so nothing hardcodes vh.ma.
      ...(process.env.MEDIA_ORIGIN
        ? [{ protocol: 'https' as const, hostname: new URL(process.env.MEDIA_ORIGIN).hostname }]
        : []),
    ],
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders() }]
  },

  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },

  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
