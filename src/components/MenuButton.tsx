'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, getTeamProfiles, setCurrentProfile, clearProfile, autoMarkInactiveProfiles } from '@/lib/auth'

type QuickNote = { id: string; label: string; value: string }
const NOTES_KEY = 'burrow-quick-notes'

// Icon values are SVG path data (24px outline set, same as the rest of the app)
const MENU_ITEMS: { label: string; href: string; icon: string[] }[] = [
  {
    label: 'Scan QR Code',
    href: '/scan',
    icon: ['M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z'],
  },
  {
    label: 'Team Calendar',
    href: '/calendar',
    icon: ['M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'],
  },
  {
    label: 'Weather',
    href: '/weather',
    icon: ['M3 15a4 4 0 004 4h9a5 5 0 001-9.9V9a5 5 0 00-9.9-1A4.002 4.002 0 003 12a4 4 0 000 3z'],
  },
  {
    label: 'Prompt Creator',
    href: '/prompt-creator',
    icon: ['M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'],
  },
  {
    label: 'Tools',
    href: '/tools',
    icon: [
      'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    ],
  },
  {
    label: 'My Flight Map',
    href: '/map',
    icon: ['M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7'],
  },
  {
    label: 'About & How to Use',
    href: '/how-to',
    icon: ['M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'],
  },
]

export default function MenuButton() {
  const router = useRouter()
  const user = getCurrentUser()
  const [teamProfiles, setTeamProfiles] = useState(getTeamProfiles())
  const [isOpen, setIsOpen] = useState(false)
  const [time, setTime] = useState<string>('')
  const [homeWeather, setHomeWeather] = useState<{ temp: number; condition: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [profilePickerOpen, setProfilePickerOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const profilePickerRef = useRef<HTMLDivElement>(null)

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
    } else {
      setProfilePickerOpen(false)
    }
  }, [isOpen])

  // Close profile picker when clicking outside it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profilePickerRef.current && !profilePickerRef.current.contains(event.target as Node)) {
        setProfilePickerOpen(false)
      }
    }

    if (profilePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [profilePickerOpen])
  
  return (
    <div className="relative" ref={menuRef}>
      {/* Menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-strong bg-surface text-gold transition-colors hover:bg-surface-raised"
        title="Menu"
        aria-label="Menu"
        aria-expanded={isOpen}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-surface border border-line-strong rounded-2xl shadow-pop z-50 animate-slide-in">
          {/* Homebase Time */}
          <div className="px-4 py-3.5 border-b border-line">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="eyebrow">Homebase</div>
              </div>
              <div className="text-sm font-semibold text-gold tabular">{time}</div>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <div className="text-xs text-white/55">San Diego, CA</div>
              {homeWeather && (
                <div className="text-xs text-white/55">{homeWeather.temp}° {homeWeather.condition}</div>
              )}
            </div>
          </div>

          {/* Profile selector — custom dropdown */}
          <div className="px-4 py-3.5 border-b border-line">
            <div className="eyebrow mb-2">Profile</div>
            <div className="relative" ref={profilePickerRef}>
              <button
                onClick={() => setProfilePickerOpen(o => !o)}
                aria-expanded={profilePickerOpen}
                className="w-full flex items-center gap-2.5 pl-2.5 pr-3 py-2 rounded-lg bg-canvas hover:bg-white/5 border border-line-strong transition-colors"
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gold text-black flex-shrink-0">
                  {user ? user.name.charAt(0) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
                <span className="flex-1 text-left text-sm font-medium text-white">
                  {user ? user.name : 'All'}
                </span>
                <svg className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform ${profilePickerOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {profilePickerOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface-raised border border-line-strong rounded-xl shadow-pop z-10 py-1.5 max-h-72 overflow-y-auto animate-slide-in">
                  <button
                    onClick={() => { clearProfile(); setProfilePickerOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      !user ? 'bg-gold text-black' : 'bg-white/10 text-white/60'
                    }`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className={`flex-1 text-left text-sm ${!user ? 'text-gold font-semibold' : 'text-white'}`}>All</span>
                    {!user && (
                      <svg className="w-3.5 h-3.5 text-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {teamProfiles.filter(p => p.active !== false).map(profile => (
                    <button
                      key={profile.id}
                      onClick={() => { setCurrentProfile(profile.id); setProfilePickerOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors"
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        user?.id === profile.id ? 'bg-gold text-black' : 'bg-white/10 text-white/60'
                      }`}>
                        {profile.name.charAt(0)}
                      </div>
                      <span className={`flex-1 text-left text-sm ${user?.id === profile.id ? 'text-gold font-semibold' : 'text-white'}`}>
                        {profile.name}
                      </span>
                      {user?.id === profile.id && (
                        <svg className="w-3.5 h-3.5 text-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}

                  {teamProfiles.filter(p => p.active === false).length > 0 && (
                    <>
                      <button
                        onClick={() => setShowInactive(o => !o)}
                        className="w-full flex items-center gap-2 px-3 py-2 mt-1 border-t border-line text-xs text-white/45 hover:text-white/70 transition-colors"
                      >
                        <svg className={`w-3 h-3 transition-transform ${showInactive ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span>Inactive ({teamProfiles.filter(p => p.active === false).length})</span>
                      </button>

                      {showInactive && teamProfiles.filter(p => p.active === false).map(profile => (
                        <button
                          key={profile.id}
                          onClick={() => { setCurrentProfile(profile.id); setProfilePickerOpen(false) }}
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/5 transition-colors"
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            user?.id === profile.id ? 'bg-gold text-black' : 'bg-white/5 text-white/40'
                          }`}>
                            {profile.name.charAt(0)}
                          </div>
                          <span className={`flex-1 text-left text-xs ${user?.id === profile.id ? 'text-gold font-semibold' : 'text-white/50'}`}>
                            {profile.name}
                          </span>
                          {user?.id === profile.id && (
                            <svg className="w-3 h-3 text-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            {MENU_ITEMS.map(item => (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href)
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white/90 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 text-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {item.icon.map(d => (
                    <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
                  ))}
                </svg>
                {item.label}
              </button>
            ))}
          </div>

          {/* Quick Notes */}
          <div className="border-t border-line">
            <button
              onClick={() => setNotesOpen(o => !o)}
              aria-expanded={notesOpen}
              className="w-full flex items-center justify-between px-5 py-3 text-sm text-white/90 hover:text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>Quick Notes</span>
                {notes.length > 0 && (
                  <span className="text-[11px] font-semibold bg-gold/15 text-gold px-1.5 py-0.5 rounded-full tabular">{notes.length}</span>
                )}
              </div>
              <svg className={`w-3.5 h-3.5 text-white/40 transition-transform ${notesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {notesOpen && (
              <div className="px-3 pb-3 space-y-1.5">
                {notes.length === 0 && !addingNote && (
                  <p className="text-xs text-white/40 text-center py-2">No notes yet. Add zip codes, PINs, lock combos…</p>
                )}

                {notes.map(note => (
                  <div key={note.id} className="bg-canvas border border-line rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white/55 truncate flex-1">{note.label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Edit inline */}
                        <button
                          onClick={() => editingId === note.id ? saveEdit(note.id) : startEdit(note)}
                          className="text-white/35 hover:text-gold transition-colors p-0.5"
                          title={editingId === note.id ? 'Save' : 'Edit'}
                          aria-label={editingId === note.id ? 'Save' : 'Edit'}
                        >
                          {editingId === note.id
                            ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-2.828 1.172H7v-2a4 4 0 011.172-2.828z" /></svg>
                          }
                        </button>
                        {/* Reveal toggle */}
                        <button
                          onClick={() => toggleReveal(note.id)}
                          className="text-white/35 hover:text-gold transition-colors p-0.5"
                          title={revealed.has(note.id) ? 'Hide' : 'Reveal'}
                          aria-label={revealed.has(note.id) ? 'Hide' : 'Reveal'}
                        >
                          {revealed.has(note.id)
                            ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          }
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => promptDelete(note)}
                          className="text-white/35 hover:text-red-400 transition-colors p-0.5"
                          title="Delete"
                          aria-label="Delete"
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
                        className="input mt-1.5 px-2.5 py-1.5"
                      />
                    ) : revealed.has(note.id) ? (
                      <div className="mt-1 text-sm text-gold font-mono tracking-wide select-all">{note.value}</div>
                    ) : (
                      <div className="mt-1 text-sm text-white/25 tracking-widest">{'•'.repeat(Math.min(note.value.length, 12))}</div>
                    )}
                  </div>
                ))}

                {addingNote ? (
                  <div className="bg-canvas border border-line rounded-lg p-2 space-y-1.5">
                    <input
                      autoFocus
                      placeholder="Label (e.g. CC Zip Code)"
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      className="input px-2.5 py-1.5 text-xs bg-surface"
                    />
                    <input
                      placeholder="Value"
                      value={newValue}
                      onChange={e => setNewValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addNote(); if (e.key === 'Escape') setAddingNote(false) }}
                      className="input px-2.5 py-1.5 text-xs bg-surface"
                    />
                    <div className="flex gap-1.5">
                      <button onClick={addNote} className="btn-primary flex-1 py-1.5 text-xs">Save</button>
                      <button onClick={() => { setAddingNote(false); setNewLabel(''); setNewValue('') }} className="btn-secondary flex-1 py-1.5 text-xs font-medium">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingNote(true)}
                    className="w-full flex items-center justify-center gap-1 py-2 text-xs text-white/50 hover:text-white/80 hover:bg-white/5 rounded-lg transition-colors border border-dashed border-line-strong"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add note
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sign Out */}
          <div className="p-2 border-t border-line">
            <button
              onClick={() => {
                // Clear PIN auth
                localStorage.removeItem('burrow-pin-auth')
                sessionStorage.removeItem('burrow-pin-auth')
                window.location.reload()
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-line">
            <div className="text-[11px] text-white/35 text-center">
              Burrow · Companion for Swanky
            </div>
          </div>

          {/* Delete confirm toast */}
          {confirmDeleteId && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6 bg-black/60 animate-fade-in" onClick={() => { setConfirmDeleteId(null); setConfirmDeleteLabel('') }}>
              <div role="alertdialog" aria-modal="true" aria-label="Delete note" className="w-full max-w-sm bg-surface border border-line-strong rounded-2xl overflow-hidden shadow-pop" onClick={e => e.stopPropagation()}>
                <div className="p-5 pb-4">
                  <p className="text-white font-semibold text-center">Delete note?</p>
                  <p className="text-white/55 text-sm text-center mt-1 truncate">{confirmDeleteLabel}</p>
                </div>
                <div className="flex border-t border-line">
                  <button
                    onClick={() => { setConfirmDeleteId(null); setConfirmDeleteLabel('') }}
                    className="flex-1 py-3.5 text-white/70 hover:bg-white/5 text-sm transition-colors"
                  >Cancel</button>
                  <button
                    onClick={() => deleteNote(confirmDeleteId)}
                    className="flex-1 py-3.5 text-red-400 hover:bg-red-500/10 text-sm font-semibold border-l border-line transition-colors"
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
