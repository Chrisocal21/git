'use client'

import { useState } from 'react'

interface CopyButtonProps {
  text: string
  label?: string
}

export default function CopyButton({ text, label = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (!text || text.trim() === '') return null

  return (
    <button
      onClick={handleCopy}
      className="ml-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
      title={label}
    >
      {copied ? '✓' : '📋'}
    </button>
  )
}
