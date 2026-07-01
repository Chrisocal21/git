'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'

export default function ScanPage() {
  const [url, setUrl] = useState('')

  useEffect(() => {
    // Get the current app URL
    setUrl(window.location.origin)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] via-[#2F5F7F] to-[#1a1a1a] p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Share App Access</h1>
          <p className="text-white/60">Scan this code to open the app on your device</p>
        </div>

        {/* QR Code Card */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
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
            <p className="text-sm text-gray-600 mb-2">Scan with your phone camera</p>
            <p className="text-xs text-gray-400 font-mono break-all">{url}</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to use
          </h3>
          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-start gap-2">
              <span className="text-[#E8B44D] font-bold">1.</span>
              <span>Open your phone's camera app</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#E8B44D] font-bold">2.</span>
              <span>Point it at the QR code</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#E8B44D] font-bold">3.</span>
              <span>Tap the notification to open the app</span>
            </li>
          </ul>
        </div>

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="mt-6 w-full py-3 bg-[#E8B44D] hover:bg-[#D4A03C] text-black font-semibold rounded-xl transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  )
}
