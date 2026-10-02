'use client'

import { useEffect } from 'react'

interface SheetFrameProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}

/** The bottom sheet every jig dialog sits in, matching the "New entry" sheet */
export default function SheetFrame({ title, subtitle, onClose, children }: SheetFrameProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-surface border border-line-strong border-b-0 rounded-t-3xl p-6 pb-8 shadow-pop animate-sheet-up"
      >
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-5" />

        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="icon-btn -mr-2 flex-shrink-0" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
