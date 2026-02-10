import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
}

export const metadata: Metadata = {
  title: 'GIT - Get It Together',
  description: 'Personal Operations System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GIT',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/icon-192.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistration />
        <div className="min-h-screen pb-16">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
