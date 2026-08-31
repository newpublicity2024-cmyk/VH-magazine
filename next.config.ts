import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

import { securityHeaders } from './src/lib/security-headers'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

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
    // Vercel Blob, once BLOB_READ_WRITE_TOKEN is set at deploy time.
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
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
