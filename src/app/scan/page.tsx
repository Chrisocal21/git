'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'

export default function ScanPage() {
  const [url, setUrl] = useState('')

  useEffect(() => {
    // Get the current app URL
    setUrl(window.location.origin)
  }, [])

  return (
    <div className="min-h-page text-white">
      <PageHeader title="Share App Access" subtitle="Scan this code to open the app on your device" width="max-w-md" />

      <div className="max-w-md mx-auto px-4 py-6">
        {/* QR Code Card */}
        <div className="bg-white rounded-2xl p-6 shadow-pop">
          <div className="flex justify-center mb-4">
            {url && (
              <QRCodeSVG
                value={url}
                size={256}
                level="H"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            )}
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1.5">Scan with your phone camera</p>
            <p className="text-xs text-gray-500 font-mono break-all">{url}</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="card mt-4 p-5">
          <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to use
          </h3>
          <ol className="space-y-2 text-sm text-white/70">
            <li className="flex items-start gap-2.5">
              <span className="text-gold font-semibold tabular">1.</span>
              <span>Open your phone's camera app</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-gold font-semibold tabular">2.</span>
              <span>Point it at the QR code</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-gold font-semibold tabular">3.</span>
              <span>Tap the notification to open the app</span>
            </li>
          </ol>
        </div>

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="btn-secondary mt-4 w-full py-3"
        >
          Back
        </button>
      </div>
    </div>
  )
}
