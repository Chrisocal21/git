'use client'

import { useState, useEffect } from 'react'
import { Fldr } from '@/types/fldr'
import RichTextEditor from '@/components/RichTextEditor'

type PolishLevel = 'light' | 'full_suit'
type ViewMode = 'polish' | 'notes'

export default function WritePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('polish')
  const [originalMessage, setOriginalMessage] = useState('')
  const [draft, setDraft] = useState('')
  const [polishLevel, setPolishLevel] = useState<PolishLevel>('light')
  const [polishedText, setPolishedText] = useState('')
  const [isPolishing, setIsPolishing] = useState(false)
  const [showOutput, setShowOutput] = useState(false)
  const [selectedFldrId, setSelectedFldrId] = useState<string | null>(null)
  const [fldrs, setFldrs] = useState<Fldr[]>([])
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [touchStartY, setTouchStartY] = useState(0)
  
  // Notes editor state
  const [notesContent, setNotesContent] = useState('')
  const [isNoteSaving, setIsNoteSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  useEffect(() => {
    // Fetch all fldrs for the dropdown
    fetch('/api/fldrs')
      .then(res => res.json())
      .then(data => setFldrs(data))
      .catch(err => console.error('Failed to fetch fldrs:', err))
  }, [])

  // Load notes content when a fldr is selected
  useEffect(() => {
    if (selectedFldrId && viewMode === 'notes') {
      const fldr = fldrs.find(f => f.id === selectedFldrId)
      if (fldr) {
        setNotesContent(fldr.notes || '')
      }
    }
  }, [selectedFldrId, fldrs, viewMode])

  // Auto-save notes after 2 seconds of inactivity
  useEffect(() => {
    if (viewMode !== 'notes' || !selectedFldrId || !notesContent) return
    
    const timer = setTimeout(() => {
      saveNotes()
    }, 2000)
    
    return () => clearTimeout(timer)
  }, [notesContent, selectedFldrId, viewMode])

  const saveNotes = async () => {
    if (!selectedFldrId) return
    
    setIsNoteSaving(true)
    try {
      await fetch(`/api/fldrs/${selectedFldrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesContent }),
      })
      setLastSaved(new Date())
    } catch (err) {
      console.error('Failed to save notes:', err)
    } finally {
      setIsNoteSaving(false)
    }
  }

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

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStartY(e.touches[0].clientY)
      setIsPulling(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || window.scrollY > 0) return
    
    const currentY = e.touches[0].clientY
    const distance = currentY - touchStartY
    
    if (distance > 0 && distance < 150) {
      setPullDistance(distance)
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      setIsRefreshing(true)
      await handleRefresh()
    }
    setIsPulling(false)
    setPullDistance(0)
    setTouchStartY(0)
  }

  const handleRefresh = async () => {
    console.log('🔄 Pull-to-refresh triggered on write page')
    
    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.update()
        
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          window.location.reload()
          return
        }
      }
    }
    
    // Refresh fldr list
    try {
      const res = await fetch('/api/fldrs', { cache: 'no-store' })
      const data = await res.json()
      setFldrs(data)
      console.log('✅ Fldrs refreshed')
    } catch (error) {
      console.error('❌ Refresh failed:', error)
    }
    
    setIsRefreshing(false)
  }

  return (
    <div 
      className="p-4 max-w-lg mx-auto pb-20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div 
          className="fixed top-0 left-0 right-0 flex justify-center items-center bg-[#0a0a0a] z-50 transition-all"
          style={{
            height: isRefreshing ? '60px' : `${Math.min(pullDistance, 80)}px`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / 80, 1)
          }}
        >
          {isRefreshing ? (
            <div className="flex items-center gap-2 text-[#3b82f6]">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium">Refreshing...</span>
            </div>
          ) : (
            <div className="text-[#3b82f6] text-sm font-medium">
              {pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
          )}
        </div>
      )}
      
      <h1 className="text-2xl font-bold mb-6">GIT</h1>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-6 border-b border-[#2a2a2a]">
        <button
          onClick={() => setViewMode('polish')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            viewMode === 'polish'
              ? 'border-[#3b82f6] text-[#3b82f6]'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          Polish Message
        </button>
        <button
          onClick={() => setViewMode('notes')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            viewMode === 'notes'
              ? 'border-[#3b82f6] text-[#3b82f6]'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          Notes Editor
        </button>
      </div>

      {viewMode === 'notes' ? (
        <>
          {/* Notes Editor Mode */}
          <div className="space-y-4">
            <div>
              <label htmlFor="notes-fldr" className="block text-sm font-medium mb-2">
                Select Fldr
              </label>
              <select
                id="notes-fldr"
                value={selectedFldrId || ''}
                onChange={(e) => setSelectedFldrId(e.target.value || null)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
              >
                <option value="">Select a fldr to edit notes...</option>
                {fldrs.map(fldr => (
                  <option key={fldr.id} value={fldr.id}>
                    {fldr.title} - {new Date(fldr.date_start).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            {selectedFldrId ? (
              <>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    {isNoteSaving && (
                      <>
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Saving...</span>
                      </>
                    )}
                    {!isNoteSaving && lastSaved && (
                      <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
                    )}
                  </div>
                  <button
                    onClick={() => saveNotes()}
                    className="text-[#3b82f6] hover:text-[#2563eb] font-medium"
                  >
                    Save Now
                  </button>
                </div>
                
                <RichTextEditor
                  value={notesContent}
                  onChange={setNotesContent}
                  placeholder="Start writing your notes here..."
                />
              </>
            ) : (
              <div className="p-8 text-center text-gray-400">
                Select a fldr above to start editing notes
              </div>
            )}
          </div>
        </>
      ) : !showOutput ? (
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
