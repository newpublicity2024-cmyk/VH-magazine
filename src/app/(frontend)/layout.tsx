import type { Metadata } from 'next'
import { Archivo, Inter } from 'next/font/google'
import React from 'react'

import './styles.css'

import { BackToTop } from '@/components/BackToTop'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { TopBar } from '@/components/TopBar'
import { getSiteSettings } from '@/lib/queries'
import { SITE } from '@/lib/site'
import { SITE_URL, ogImageUrl } from '@/lib/seo'

/**
 * Self-hosted via next/font (spec §9): subsetted, preloaded, `display: swap`,
 * and no render-blocking request to a font CDN. Latin only — the site is
 * French, so shipping other subsets would be dead weight.
 */
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
})

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-archivo',
})

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings().catch(() => null)
  const image = ogImageUrl(
    (settings?.defaultOgImage as { url?: string } | null) ?? null,
  )

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      // Spec §9 title pattern: "{Page} | VH Magazine Maroc | VH Magazine".
      default: 'VH Magazine Maroc | VH Magazine',
      template: '%s | VH Magazine Maroc | VH Magazine',
    },
    description: settings?.description || SITE.description,
    openGraph: {
      type: 'website',
      siteName: SITE.name,
      locale: SITE.locale,
      images: image ? [{ url: image, width: 1200, height: 630 }] : undefined,
    },
    twitter: { card: 'summary_large_image', site: SITE.twitterHandle },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings().catch(() => null)
  const social = (settings?.social as Parameters<typeof Header>[0]['social']) ?? null

  return (
    <html lang={SITE.lang} className={`${inter.variable} ${archivo.variable}`}>
      <body className="flex min-h-screen flex-col bg-surface text-ink-soft">
        <a
          href="#main"
          className="sr-only bg-vh-red px-4 py-2 text-white focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-[200]"
        >
          Aller au contenu principal
        </a>

        <TopBar social={social} />
        <Header social={social} />

        <main id="main" tabIndex={-1} className="flex-1">
          {children}
        </main>

        <Footer social={social} />
        <BackToTop />
      </body>
    </html>
  )
}
