'use client'

import { useState, useEffect } from 'react'
import { Fldr } from '@/types/fldr'

type PolishLevel = 'light' | 'full_suit'

export default function WritePage() {
  const [originalMessage, setOriginalMessage] = useState('')
  const [draft, setDraft] = useState('')
  const [polishLevel, setPolishLevel] = useState<PolishLevel>('light')
  const [polishedText, setPolishedText] = useState('')
  const [isPolishing, setIsPolishing] = useState(false)
  const [showOutput, setShowOutput] = useState(false)
  const [selectedFldrId, setSelectedFldrId] = useState<string | null>(null)
  const [fldrs, setFldrs] = useState<Fldr[]>([])

  useEffect(() => {
    // Fetch all fldrs for the dropdown
    fetch('/api/fldrs')
      .then(res => res.json())
      .then(data => setFldrs(data))
      .catch(err => console.error('Failed to fetch fldrs:', err))
  }, [])

  const handlePolish = async () => {
    if (!draft.trim()) return
    
    setIsPolishing(true)
    try {
      const response = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_message: originalMessage,
          draft,
          polish_level: polishLevel,
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        setPolishedText(data.polished)
        setShowOutput(true)
        
        // If a fldr is selected, save the polished message to it
        if (selectedFldrId) {
          try {
            const fldr = fldrs.find(f => f.id === selectedFldrId)
            if (fldr) {
              const newMessage = {
                original: originalMessage,
                draft,
                polished: data.polished,
                polish_level: polishLevel,
                created_at: new Date().toISOString(),
              }
              await fetch(`/api/fldrs/${selectedFldrId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  polished_messages: [...fldr.polished_messages, newMessage]
                }),
              })
            }
          } catch (err) {
            console.error('Failed to save to fldr:', err)
          }
        }
      }
    } catch (error) {
      console.error('Polish failed:', error)
    } finally {
      setIsPolishing(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(polishedText)
      // Could add a toast notification here
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

  const handleReset = () => {
    setShowOutput(false)
    setPolishedText('')
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <h1 className="text-2xl font-bold mb-6">GIT</h1>

      {!showOutput ? (
        <>
          <h2 className="text-xl font-semibold mb-4">Polish Message</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="fldr" className="block text-sm font-medium mb-2 text-gray-400">
                Link to Fldr <span className="text-xs">(optional)</span>
              </label>
              <select
                id="fldr"
                value={selectedFldrId || ''}
                onChange={(e) => setSelectedFldrId(e.target.value || null)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
              >
                <option value="">None - Not linked to a fldr</option>
                {fldrs.map(fldr => (
                  <option key={fldr.id} value={fldr.id}>
                    {fldr.title} - {new Date(fldr.date_start).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="original" className="block text-sm font-medium mb-2 text-gray-400">
                Original Message <span className="text-xs">(optional - for context)</span>
              </label>
              <textarea
                id="original"
                value={originalMessage}
                onChange={(e) => setOriginalMessage(e.target.value)}
                className="w-full min-h-[100px] px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] resize-none"
                placeholder="Paste the message you're replying to..."
              />
            </div>

            <div>
              <label htmlFor="draft" className="block text-sm font-medium mb-2">
                Your Draft
              </label>
              <textarea
                id="draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full min-h-[150px] px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] resize-none"
                placeholder="Write your raw message here..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Polish Level</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPolishLevel('light')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    polishLevel === 'light'
                      ? 'border-[#3b82f6] bg-[#3b82f6]/10'
                      : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3b82f6]/50'
                  }`}
                >
                  <div className="font-semibold mb-1">Light</div>
                  <div className="text-xs text-gray-400">
                    Grammar + clarity, stays close to original
                  </div>
                </button>
                <button
                  onClick={() => setPolishLevel('full_suit')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    polishLevel === 'full_suit'
                      ? 'border-[#3b82f6] bg-[#3b82f6]/10'
                      : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3b82f6]/50'
                  }`}
                >
                  <div className="font-semibold mb-1">Full Suit</div>
                  <div className="text-xs text-gray-400">
                    Restructured, professional, thorough
                  </div>
                </button>
              </div>
            </div>

            <button
              onClick={handlePolish}
              disabled={!draft.trim() || isPolishing}
              className="w-full py-3 bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isPolishing ? 'Polishing...' : 'Polish'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Polished Message</h2>
            <button
              onClick={handleReset}
              className="text-sm text-gray-400 hover:text-gray-300"
            >
              ← Back
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <div className="whitespace-pre-wrap">{polishedText}</div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 py-3 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg font-medium transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3b82f6] rounded-lg font-medium transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
