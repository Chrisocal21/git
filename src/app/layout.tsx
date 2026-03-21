import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import PinAuthWrapper from '@/components/PinAuthWrapper'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
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
    apple: '/icon-192.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA capability tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* iOS still needs this for PWA to work - deprecation warning is expected */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body suppressHydrationWarning>
        <ServiceWorkerRegistration />
        <PinAuthWrapper>
          <div className="min-h-screen pb-16">
            {children}
          </div>
          <BottomNav />
        </PinAuthWrapper>
      </body>
    </html>
  )
}
