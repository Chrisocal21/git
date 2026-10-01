'use client'

import { useRouter } from 'next/navigation'

interface PageHeaderProps {
  title: string
  subtitle?: string
  // Defaults to browser back
  onBack?: () => void
  // Right-aligned controls
  actions?: React.ReactNode
  // Tailwind max-width class for the inner row, matched to the page's content column
  width?: string
}

export default function PageHeader({ title, subtitle, onBack, actions, width = 'max-w-2xl' }: PageHeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className={`mx-auto flex h-14 items-center gap-2 px-4 ${width}`}>
        <button
          onClick={onBack ?? (() => router.back())}
          className="icon-btn -ml-2"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight text-white">{title}</h1>
          {subtitle && <p className="truncate text-xs text-white/45 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-1">{actions}</div>}
      </div>
    </header>
  )
}
