'use client'

import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

interface Tool {
  href: string
  title: string
  description: string
  icon: JSX.Element
}

const TOOLS: Tool[] = [
  {
    href: '/tools/tip-calculator',
    title: 'Tip Calculator',
    description: 'Split the bill and figure out the tip fast.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3v-3m-3 3v-3m0-4V7a2 2 0 012-2h2a2 2 0 012 2v3M5 10h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1z" />
      </svg>
    ),
  },
]

export default function ToolsPage() {
  const router = useRouter()

  return (
    <div className="min-h-page text-white">
      <PageHeader title="Tools" subtitle="Quick utilities for on the road." />

      <div className="px-4 py-6 max-w-2xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TOOLS.map(tool => (
            <button
              key={tool.href}
              onClick={() => router.push(tool.href)}
              className="card shadow-card text-left p-4 flex items-start gap-3.5 hover:border-line-strong hover:bg-surface-raised transition-colors"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                {tool.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-semibold text-sm">{tool.title}</h3>
                <p className="text-white/55 text-xs mt-1">{tool.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
