'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { FolderIcon, MapIcon, CalendarIcon, PlusIcon, BriefcaseIcon } from './Icons'
import { getTeamProfiles } from '@/lib/auth'

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [today, setToday] = useState(() => new Date().getDate())
  const [expanded, setExpanded] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  const [showNewModal, setShowNewModal] = useState(false)
  const [showTimeOffForm, setShowTimeOffForm] = useState(false)
  const teamProfiles = getTeamProfiles()
  const [timeOffPerson, setTimeOffPerson] = useState('')
  const [timeOffStart, setTimeOffStart] = useState('')
  const [timeOffEnd, setTimeOffEnd] = useState('')
  const [timeOffNote, setTimeOffNote] = useState('')
  const [timeOffSaving, setTimeOffSaving] = useState(false)

  useEffect(() => {
    const update = () => setToday(new Date().getDate())
    update()
    // Re-check periodically in case the app stays open across midnight
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!timeOffPerson && teamProfiles.length > 0) setTimeOffPerson(teamProfiles[0].id)
  }, [teamProfiles, timeOffPerson])

  // Collapse the speed-dial when clicking outside it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setExpanded(false)
      }
    }
    if (expanded) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [expanded])

  const isActive = (path: string) => pathname?.startsWith(path)

  const go = (path: string) => {
    router.push(path)
    setExpanded(false)
  }

  const openNewModal = () => {
    setShowTimeOffForm(false)
    setShowNewModal(true)
    setExpanded(false)
  }

  const handleCreateTimeOff = async () => {
    if (!timeOffPerson || !timeOffStart) return
    setTimeOffSaving(true)
    const profile = teamProfiles.find(p => p.id === timeOffPerson)
    const newEntry = {
      title: `${profile?.name ?? timeOffPerson} – Time Off`,
      fldr_type: 'time_off' as const,
      date_start: timeOffStart,
      date_end: timeOffEnd || null,
      location: null,
      people: [{ name: profile?.name ?? timeOffPerson, role: null, phone: null, email: null }],
      notes: timeOffNote || '',
    }
    try {
      const res = await fetch('/api/fldrs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry),
      })
      if (res.ok) {
        setShowNewModal(false)
        setShowTimeOffForm(false)
        setTimeOffStart('')
        setTimeOffEnd('')
        setTimeOffNote('')
        router.refresh()
      } else {
        alert('Failed to create time off entry')
      }
    } catch {
      alert('Failed to create time off entry')
    }
    setTimeOffSaving(false)
  }

  return (
    <>
      <nav className="fixed bottom-6 left-0 right-0 pointer-events-none z-40">
        <div ref={navRef} className="flex justify-center items-center max-w-lg mx-auto px-4">
          <div
            className={`pointer-events-auto flex items-center gap-3 bg-[#1a1a1a]/90 backdrop-blur-sm rounded-full shadow-xl px-2 py-2 transition-all duration-200 ${
              expanded ? 'pr-2' : ''
            }`}
          >
            {expanded && (
              <>
                <button
                  onClick={() => go('/jobs')}
                  className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                    isActive('/jobs') ? 'bg-[#E8B44D] text-black' : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Jobs"
                >
                  <FolderIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={() => go('/calendar')}
                  className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                    isActive('/calendar') ? 'bg-[#E8B44D] text-black' : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Calendar"
                >
                  <CalendarIcon className="w-6 h-6" day={today} />
                </button>

                <button
                  onClick={() => go('/map')}
                  className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                    isActive('/map') ? 'bg-[#E8B44D] text-black' : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Map"
                >
                  <MapIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={openNewModal}
                  className="flex items-center justify-center w-12 h-12 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                  title="New"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>

                <div className="w-px h-6 bg-white/10" />
              </>
            )}

            {/* Master toggle — badger logo when closed, plus (rotated to an ×) when open */}
            <button
              onClick={() => setExpanded(o => !o)}
              className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all overflow-hidden ${
                expanded
                  ? 'bg-white/10 text-white'
                  : 'bg-white hover:bg-white/90'
              }`}
            >
              {expanded ? (
                <PlusIcon className="w-6 h-6 rotate-45 transition-transform" />
              ) : (
                <img
                  src="/badger-logo.png"
                  alt="Menu"
                  className="w-full h-full object-cover scale-110"
                />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ── New Entry Modal ── */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => { setShowNewModal(false); setShowTimeOffForm(false) }}
        >
          <div
            className="w-full max-w-lg bg-[#1a2332] border border-white/10 rounded-t-3xl p-6 pb-8 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {!showTimeOffForm ? (
              <>
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />
                <p className="text-xs text-white/40 text-center uppercase tracking-widest mb-5">What are you creating?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setShowNewModal(false); router.push('/jobs/create') }}
                    className="flex flex-col items-center gap-3 p-6 bg-[#0f1419] border border-white/10 rounded-2xl hover:bg-[#1e2938] hover:border-[#2a7b9b]/50 transition-all"
                  >
                    <BriefcaseIcon className="w-8 h-8 text-[#2a7b9b]" />
                    <span className="font-semibold text-white">New Job</span>
                    <span className="text-xs text-white/40 text-center leading-relaxed">Full job with flights, venues & details</span>
                  </button>
                  <button
                    onClick={() => setShowTimeOffForm(true)}
                    className="flex flex-col items-center gap-3 p-6 bg-[#0f1419] border border-white/10 rounded-2xl hover:bg-[#1e2938] hover:border-emerald-500/50 transition-all"
                  >
                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold text-white">Time Off</span>
                    <span className="text-xs text-white/40 text-center leading-relaxed">Calendar-only — won't appear in jobs list</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setShowTimeOffForm(false)} className="text-white/40 hover:text-white/80 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h2 className="font-semibold text-white text-lg">Time Off</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-white/50 mb-2 font-medium">Person</label>
                    <select
                      value={timeOffPerson}
                      onChange={e => setTimeOffPerson(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#0f1419] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm text-white"
                    >
                      {teamProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-white/50 mb-2 font-medium">Start Date <span className="text-red-400">*</span></label>
                      <input
                        type="date"
                        value={timeOffStart}
                        onChange={e => setTimeOffStart(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0f1419] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-2 font-medium">End Date</label>
                      <input
                        type="date"
                        value={timeOffEnd}
                        onChange={e => setTimeOffEnd(e.target.value)}
                        min={timeOffStart}
                        className="w-full px-4 py-2.5 bg-[#0f1419] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-2 font-medium">Note (optional)</label>
                    <input
                      type="text"
                      value={timeOffNote}
                      onChange={e => setTimeOffNote(e.target.value)}
                      placeholder="Vacation, sick day..."
                      className="w-full px-4 py-2.5 bg-[#0f1419] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm text-white placeholder:text-white/30"
                    />
                  </div>
                  <button
                    onClick={handleCreateTimeOff}
                    disabled={!timeOffStart || timeOffSaving}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold text-white transition-colors"
                  >
                    {timeOffSaving ? 'Saving...' : 'Add to Calendar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
