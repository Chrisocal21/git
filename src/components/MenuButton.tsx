'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, getTeamProfiles, setCurrentProfile, clearProfile, autoMarkInactiveProfiles } from '@/lib/auth'

type QuickNote = { id: string; label: string; value: string }
const NOTES_KEY = 'burrow-quick-notes'

export default function MenuButton() {
  const router = useRouter()
  const user = getCurrentUser()
  const [teamProfiles, setTeamProfiles] = useState(getTeamProfiles())
  const [isOpen, setIsOpen] = useState(false)
  const [time, setTime] = useState<string>('')
  const [homeWeather, setHomeWeather] = useState<{ temp: number; condition: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Quick Notes state
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState<QuickNote[]>([])
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [addingNote, setAddingNote] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteLabel, setConfirmDeleteLabel] = useState<string>('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTES_KEY)
      if (stored) setNotes(JSON.parse(stored))
    } catch {}
    // Sync from cloud on mount
    fetch('/api/notes')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.notes?.length) {
          setNotes(data.notes)
          localStorage.setItem(NOTES_KEY, JSON.stringify(data.notes))
        }
      })
      .catch(() => {})
  }, [])

  // Auto-mark inactive profiles when menu opens
  useEffect(() => {
    if (isOpen) {
      autoMarkInactiveProfiles()
      setTeamProfiles(getTeamProfiles())
    }
  }, [isOpen])

  const saveNotes = (updated: QuickNote[]) => {
    setNotes(updated)
    localStorage.setItem(NOTES_KEY, JSON.stringify(updated))
    // Persist to cloud
    fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: updated }),
    }).catch(() => {})
  }

  const addNote = () => {
    if (!newLabel.trim() || !newValue.trim()) return
    const updated = [...notes, { id: Date.now().toString(), label: newLabel.trim(), value: newValue.trim() }]
    saveNotes(updated)
    setNewLabel('')
    setNewValue('')
    setAddingNote(false)
  }

  const deleteNote = (id: string) => {
    saveNotes(notes.filter(n => n.id !== id))
    setRevealed(prev => { const s = new Set(prev); s.delete(id); return s })
    setConfirmDeleteId(null)
    setConfirmDeleteLabel('')
  }

  const promptDelete = (note: QuickNote) => {
    setConfirmDeleteId(note.id)
    setConfirmDeleteLabel(note.label)
  }

  const toggleReveal = (id: string) => {
    setRevealed(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const startEdit = (note: QuickNote) => {
    setEditingId(note.id)
    setEditValue(note.value)
  }

  const saveEdit = (id: string) => {
    if (!editValue.trim()) return
    saveNotes(notes.map(n => n.id === id ? { ...n, value: editValue.trim() } : n))
    setEditingId(null)
  }
  
  // Update San Diego time
  useEffect(() => {
    const updateTime = () => {
      const sdTime = new Date().toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      setTime(sdTime)
    }

    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  // Fetch homebase weather once on open
  useEffect(() => {
    if (!isOpen || homeWeather) return
    fetch('/api/weather?location=San%20Diego%2C%20CA')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.current && typeof data.current.temp === 'number') {
          setHomeWeather({ temp: Math.round(data.current.temp), condition: data.current.main || data.current.description })
        }
      })
      .catch(() => {})
  }, [isOpen])
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])
  
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  return (
    <div className="relative" ref={menuRef}>
      {/* Menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-[#2F5F7F] hover:bg-[#3A6B86] rounded-lg transition-colors"
        title="Menu"
      >
        <svg className="w-5 h-5 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gradient-to-br from-[#3A6B86] to-[#2F5F7F] backdrop-blur-xl border border-[#E8B44D]/20 rounded-xl shadow-xl z-50">
          {/* Homebase Time */}
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-white/70">Homebase</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-[#E8B44D]">{time}</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/50 mt-1">San Diego, CA</div>
              {homeWeather && (
                <div className="text-xs text-white/50 mt-1">{homeWeather.temp}° {homeWeather.condition}</div>
              )}
            </div>
          </div>
          
          {/* Profile selector — always visible */}
          <div className="p-3 border-b border-white/10">
            <div className="text-xs text-white/50 mb-2">Profile</div>
            <div className="space-y-1">
              {/* All / Guest option */}
              <button
                onClick={() => { clearProfile(); setIsOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                  !user
                    ? 'bg-[#E8B44D]/20 border border-[#E8B44D]/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  !user ? 'bg-[#E8B44D] text-black' : 'bg-white/10 text-white/70'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-medium ${!user ? 'text-[#E8B44D]' : 'text-white'}`}>All</div>
                </div>
                {!user && (
                  <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Active Team profiles */}
              {teamProfiles.filter(p => p.active !== false).map(profile => (
                <button
                  key={profile.id}
                  onClick={() => {
                    if (user?.id === profile.id) {
                      clearProfile()
                    } else {
                      setCurrentProfile(profile.id)
                    }
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    user?.id === profile.id
                      ? 'bg-[#E8B44D]/20 border border-[#E8B44D]/30'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    user?.id === profile.id ? 'bg-[#E8B44D] text-black' : 'bg-white/10 text-white/70'
                  }`}>
                    {profile.name.charAt(0)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className={`text-sm font-medium ${
                      user?.id === profile.id ? 'text-[#E8B44D]' : 'text-white'
                    }`}>
                      {profile.name}
                    </div>
                  </div>
                  {user?.id === profile.id && (
                    <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
              
              {/* Inactive profiles toggle */}
              {teamProfiles.filter(p => p.active === false).length > 0 && (
                <>
                  <button
                    onClick={() => setShowInactive(!showInactive)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 mt-2 text-xs text-white/40 hover:text-white/60 transition-colors"
                  >
                    <svg className={`w-3 h-3 transition-transform ${showInactive ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span>Inactive ({teamProfiles.filter(p => p.active === false).length})</span>
                  </button>
                  
                  {showInactive && teamProfiles.filter(p => p.active === false).map(profile => (
                    <button
                      key={profile.id}
                      onClick={() => {
                        if (user?.id === profile.id) {
                          clearProfile()
                        } else {
                          setCurrentProfile(profile.id)
                        }
                        setIsOpen(false)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                        user?.id === profile.id
                          ? 'bg-[#E8B44D]/20 border border-[#E8B44D]/30'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        user?.id === profile.id ? 'bg-[#E8B44D] text-black' : 'bg-white/5 text-white/40'
                      }`}>
                        {profile.name.charAt(0)}
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`text-xs ${
                          user?.id === profile.id ? 'text-[#E8B44D]' : 'text-white/40'
                        }`}>
                          {profile.name}
                        </div>
                      </div>
                      {user?.id === profile.id && (
                        <svg className="w-3 h-3 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="p-2">
            <button
              onClick={() => {
                router.push('/calendar')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Team Calendar
            </button>

            <button
              onClick={() => {
                router.push('/map')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              My Flight Map
            </button>
            
            <button
              onClick={() => {
                router.push('/about')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              About
            </button>
            
            <button
              onClick={() => {
                router.push('/how-to')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How to Use
            </button>
          </div>
          
          {/* Quick Notes */}
          <div className="border-t border-white/10">
            <button
              onClick={() => setNotesOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>Quick Notes</span>
                {notes.length > 0 && (
                  <span className="text-xs bg-[#E8B44D]/20 text-[#E8B44D] px-1.5 py-0.5 rounded-full">{notes.length}</span>
                )}
              </div>
              <svg className={`w-3 h-3 text-white/40 transition-transform ${notesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {notesOpen && (
              <div className="px-3 pb-3 space-y-1.5">
                {notes.length === 0 && !addingNote && (
                  <p className="text-xs text-white/30 text-center py-2">No notes yet. Add zip codes, PINs, lock combos…</p>
                )}

                {notes.map(note => (
                  <div key={note.id} className="bg-black/30 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white/50 truncate flex-1">{note.label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Edit inline */}
                        <button
                          onClick={() => editingId === note.id ? saveEdit(note.id) : startEdit(note)}
                          className="text-white/30 hover:text-[#E8B44D] transition-colors p-0.5"
                          title={editingId === note.id ? 'Save' : 'Edit'}
                        >
                          {editingId === note.id
                            ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-2.828 1.172H7v-2a4 4 0 011.172-2.828z" /></svg>
                          }
                        </button>
                        {/* Reveal toggle */}
                        <button
                          onClick={() => toggleReveal(note.id)}
                          className="text-white/30 hover:text-[#E8B44D] transition-colors p-0.5"
                          title={revealed.has(note.id) ? 'Hide' : 'Reveal'}
                        >
                          {revealed.has(note.id)
                            ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          }
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => promptDelete(note)}
                          className="text-white/30 hover:text-red-400 transition-colors p-0.5"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                    {editingId === note.id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(note.id); if (e.key === 'Escape') setEditingId(null) }}
                        className="mt-1 w-full bg-black/40 text-white text-sm px-2 py-1 rounded border border-[#E8B44D]/40 focus:outline-none focus:border-[#E8B44D]"
                      />
                    ) : revealed.has(note.id) ? (
                      <div className="mt-1 text-sm text-[#E8B44D] font-mono tracking-wide select-all">{note.value}</div>
                    ) : (
                      <div className="mt-1 text-sm text-white/20 tracking-widest">{'•'.repeat(Math.min(note.value.length, 12))}</div>
                    )}
                  </div>
                ))}

                {addingNote ? (
                  <div className="bg-black/30 rounded-lg p-2 space-y-1.5">
                    <input
                      autoFocus
                      placeholder="Label (e.g. CC Zip Code)"
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      className="w-full bg-black/40 text-white text-xs px-2 py-1.5 rounded border border-white/10 focus:outline-none focus:border-[#E8B44D]/50 placeholder-white/20"
                    />
                    <input
                      placeholder="Value"
                      value={newValue}
                      onChange={e => setNewValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addNote(); if (e.key === 'Escape') setAddingNote(false) }}
                      className="w-full bg-black/40 text-white text-xs px-2 py-1.5 rounded border border-white/10 focus:outline-none focus:border-[#E8B44D]/50 placeholder-white/20"
                    />
                    <div className="flex gap-1.5">
                      <button onClick={addNote} className="flex-1 py-1 bg-[#E8B44D] hover:bg-[#D4A03C] text-black text-xs font-semibold rounded transition-colors">Save</button>
                      <button onClick={() => { setAddingNote(false); setNewLabel(''); setNewValue('') }} className="flex-1 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingNote(true)}
                    className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors border border-dashed border-white/10"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add note
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sign Out */}
          <div className="p-2 border-t border-white/10">
            <button
              onClick={() => {
                // Clear PIN auth
                localStorage.removeItem('burrow-pin-auth')
                sessionStorage.removeItem('burrow-pin-auth')
                window.location.reload()
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
          
          {/* Footer */}
          <div className="p-3 border-t border-white/10">
            <div className="text-xs text-white/50 text-center">
              Burrow · Companion for Swanky
            </div>
          </div>

          {/* Delete confirm toast */}
          {confirmDeleteId && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6" onClick={() => { setConfirmDeleteId(null); setConfirmDeleteLabel('') }}>
              <div className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 pb-3">
                  <p className="text-white font-semibold text-center">Delete note?</p>
                  <p className="text-white/50 text-sm text-center mt-1 truncate">{confirmDeleteLabel}</p>
                </div>
                <div className="flex border-t border-white/10">
                  <button
                    onClick={() => { setConfirmDeleteId(null); setConfirmDeleteLabel('') }}
                    className="flex-1 py-3.5 text-white/70 hover:bg-white/5 text-sm transition-colors"
                  >Cancel</button>
                  <button
                    onClick={() => deleteNote(confirmDeleteId)}
                    className="flex-1 py-3.5 text-red-400 hover:bg-red-500/10 text-sm font-semibold border-l border-white/10 transition-colors"
                  >Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
