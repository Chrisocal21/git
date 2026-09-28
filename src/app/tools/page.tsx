'use client'

import { useRouter } from 'next/navigation'

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
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3v-3m-3 3v-3m0-4V7a2 2 0 012-2h2a2 2 0 012 2v3M5 10h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1z" />
      </svg>
    ),
  },
]

export default function ToolsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#3A6B86] to-[#2F5F7F] p-6 pb-8">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-4 text-white/70 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-[#E8B44D] mb-2">Tools</h1>
          <p className="text-white/80 text-sm">Quick utilities for on the road.</p>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TOOLS.map(tool => (
            <button
              key={tool.href}
              onClick={() => router.push(tool.href)}
              className="text-left bg-gradient-to-br from-[#2F5F7F]/20 to-[#1a3a4d]/20 p-4 rounded-xl border border-[#E8B44D]/10 hover:border-[#E8B44D]/30 hover:bg-white/5 transition-colors"
            >
              <div className="text-[#E8B44D] mb-2">{tool.icon}</div>
              <h3 className="text-[#E8B44D] font-semibold mb-1 text-sm">{tool.title}</h3>
              <p className="text-white/60 text-xs">{tool.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
