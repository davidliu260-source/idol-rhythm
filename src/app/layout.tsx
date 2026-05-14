import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'Idol Rhythm · 星動時刻',
  description: '追蹤你的偶像行程，不錯過每一個星動瞬間。',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#08080f',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className="bg-bg text-text-base min-h-screen">
        <main className="mx-auto max-w-md min-h-screen pb-28">{children}</main>
        <BottomNav />
      </body>
    </html>
  )
}
