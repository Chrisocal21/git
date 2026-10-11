'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { FolderIcon, MapIcon, CalendarIcon, PlusIcon, BriefcaseIcon, ChevronLeftIcon, ClockIcon } from './Icons'
import TimeOffForm from './TimeOffForm'

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [today, setToday] = useState(() => new Date().getDate())
  const [expanded, setExpanded] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  const [showNewModal, setShowNewModal] = useState(false)
  const [showTimeOffForm, setShowTimeOffForm] = useState(false)

  useEffect(() => {
    const update = () => setToday(new Date().getDate())
    update()
    // Re-check periodically in case the app stays open across midnight
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [])

  // Collapse the speed-dial when clicking outside it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setExpanded(false)
      }
    }
    if (expanded) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchstart', handleClickOutside)
      }
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

  const closeNewModal = () => {
    setShowNewModal(false)
    setShowTimeOffForm(false)
  }

  // Each stop on the dock: its icon with its name underneath, so nobody has to guess
  const stop = (active: boolean) =>
    `flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium leading-none transition-colors ${
      active ? 'bg-gold text-black' : 'text-white/60 hover:text-white hover:bg-white/10'
    }`

  return (
    <>
      <nav aria-label="Main" className="fixed bottom-6 left-0 right-0 pointer-events-none z-40">
        <div ref={navRef} className="flex justify-center items-center max-w-lg mx-auto px-2">
          <div
            className="pointer-events-auto flex items-center gap-1 bg-surface-raised/90 backdrop-blur-md border border-line-strong rounded-full shadow-pop p-2 transition-all duration-200"
          >
            {expanded && (
              <>
                <button
                  onClick={() => go('/jobs')}
                  className={stop(!!isActive('/jobs'))}
                  aria-label="Jobs"
                  aria-current={isActive('/jobs') ? 'page' : undefined}
                >
                  <FolderIcon className="w-5 h-5" />
                  <span aria-hidden="true">Jobs</span>
                </button>

                <button
                  onClick={() => go('/calendar')}
                  className={stop(!!isActive('/calendar'))}
                  aria-label="Calendar"
                  aria-current={isActive('/calendar') ? 'page' : undefined}
                >
                  <CalendarIcon className="w-5 h-5" day={today} />
                  <span aria-hidden="true">Calendar</span>
                </button>

                <button
                  onClick={() => go('/map')}
                  className={stop(!!isActive('/map'))}
                  aria-label="Map"
                  aria-current={isActive('/map') ? 'page' : undefined}
                >
                  <MapIcon className="w-5 h-5" />
                  <span aria-hidden="true">Map</span>
                </button>

                <button onClick={openNewModal} className={stop(false)} aria-label="New">
                  <PlusIcon className="w-5 h-5" />
                  <span aria-hidden="true">New</span>
                </button>

                <div className="w-px h-6 bg-line-strong" />
              </>
            )}

            {/* Master toggle — badger logo when closed, plus (rotated to an ×) when open */}
            <button
              onClick={() => setExpanded(o => !o)}
              aria-label={expanded ? 'Close navigation' : 'Open navigation'}
              aria-expanded={expanded}
              className={`flex items-center justify-center w-14 h-14 rounded-full transition-colors overflow-hidden ${
                expanded
                  ? 'bg-white/10 text-white hover:bg-white/15'
                  : 'bg-white hover:bg-white/90'
              }`}
            >
              {expanded ? (
                <PlusIcon className="w-6 h-6 rotate-45 transition-transform" />
              ) : (
                <img
                  src="/badger-logo.png"
                  alt=""
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={closeNewModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={showTimeOffForm ? 'Time Off' : 'New entry'}
            className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-surface border border-line-strong border-b-0 rounded-t-3xl p-6 pb-8 shadow-pop animate-sheet-up"
            onClick={e => e.stopPropagation()}
          >
            {!showTimeOffForm ? (
              <>
                <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-6" />
                <p className="eyebrow text-center mb-5">What are you creating?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setShowNewModal(false); router.push('/jobs/create') }}
                    className="flex flex-col items-center gap-3 p-6 bg-canvas border border-line rounded-2xl hover:bg-surface-raised hover:border-brand/60 transition-colors"
                  >
                    <BriefcaseIcon className="w-8 h-8 text-brand-light" />
                    <span className="font-semibold text-white">New Job</span>
                    <span className="text-xs text-white/50 text-center leading-relaxed">Full job with flights, venues & details</span>
                  </button>
                  <button
                    onClick={() => setShowTimeOffForm(true)}
                    className="flex flex-col items-center gap-3 p-6 bg-canvas border border-line rounded-2xl hover:bg-surface-raised hover:border-emerald-500/60 transition-colors"
                  >
                    <ClockIcon className="w-8 h-8 text-emerald-400" />
                    <span className="font-semibold text-white">Time Off</span>
                    <span className="text-xs text-white/50 text-center leading-relaxed">Calendar-only — won&apos;t appear in jobs list</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 mb-5">
                  <button onClick={() => setShowTimeOffForm(false)} className="icon-btn h-11 w-11 -ml-2.5" aria-label="Back">
                    <ChevronLeftIcon className="w-5 h-5" />
                  </button>
                  <h2 className="font-semibold text-white text-lg">Time Off</h2>
                </div>
                <TimeOffForm onDone={closeNewModal} />
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
