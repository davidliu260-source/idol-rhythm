import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import { AppStateProvider } from '@/lib/appState'
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_NAME, SITE_URL } from '@/lib/seo/metadata'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: '%s｜星動時刻' },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'zh_TW' },
  twitter: { card: 'summary_large_image' },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#07070f',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className="bg-bg text-text-base min-h-screen">
        <AppStateProvider>
          <main className="mx-auto max-w-md min-h-screen pb-28">{children}</main>
          <BottomNav />
        </AppStateProvider>
        <Analytics />
      </body>
    </html>
  )
}
