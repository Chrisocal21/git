import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import PinAuthWrapper from '@/components/PinAuthWrapper'
import DialogHost from '@/components/Dialogs'

// Self-hosted at build time: no runtime request to Google, works offline
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f1419',
}

export const metadata: Metadata = {
  title: 'burrow',
  description: 'A companion tool for Swanky event pros',
  manifest: '/manifest.json',
  appleWebApp: {
    statusBarStyle: 'black-translucent',
    title: 'burrow',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/icon-192.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* PWA capability tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* iOS still needs this for PWA to work - deprecation warning is expected */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* Explicit apple touch icon - iOS uses this for home screen */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body suppressHydrationWarning>
        <ServiceWorkerRegistration />
        <PinAuthWrapper>
          <div className="min-h-screen pb-28">
            {children}
          </div>
          <BottomNav />
        </PinAuthWrapper>
        <DialogHost />
      </body>
    </html>
  )
}
