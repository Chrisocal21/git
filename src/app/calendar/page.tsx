'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fldr } from '@/types/fldr'
import { getTeamProfiles } from '@/lib/auth'
import { AirplaneIcon, BriefcaseIcon, MapPinIcon } from '@/components/Icons'

// Per-profile color palette (index matches TEAM_PROFILES order)
const DOT_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-yellow-500', 'bg-cyan-500', 'bg-red-500',
  'bg-lime-500', 'bg-indigo-500', 'bg-teal-500', 'bg-fuchsia-500',
]
const CHIP_BG = [
  'bg-blue-500/20', 'bg-emerald-500/20', 'bg-purple-500/20', 'bg-orange-500/20',
  'bg-pink-500/20', 'bg-yellow-500/20', 'bg-cyan-500/20', 'bg-red-500/20',
  'bg-lime-500/20', 'bg-indigo-500/20', 'bg-teal-500/20', 'bg-fuchsia-500/20',
]
const CHIP_TEXT = [
  'text-blue-300', 'text-emerald-300', 'text-purple-300', 'text-orange-300',
  'text-pink-300', 'text-yellow-300', 'text-cyan-300', 'text-red-300',
  'text-lime-300', 'text-indigo-300', 'text-teal-300', 'text-fuchsia-300',
]
const LEGEND_TEXT = [
  'text-blue-400', 'text-emerald-400', 'text-purple-400', 'text-orange-400',
  'text-pink-400', 'text-yellow-400', 'text-cyan-400', 'text-red-400',
  'text-lime-400', 'text-indigo-400', 'text-teal-400', 'text-fuchsia-400',
]

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Absence {
  profileId: string
  personName: string
  jobTitle: string
  jobId: string
  isPast: boolean
  dayType: 'travel' | 'work' | 'off'
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDate(str: string | null | undefined): Date | null {
  if (!str) return null
  // Handle both "2026-04-21" and ISO strings
  const d = new Date(str.includes('T') ? str : str + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function getJobDateRange(fldr: Fldr): { start: Date; end: Date } | null {
  let start: Date | null = null
  let end: Date | null = null

  // Prefer flight times for precision
  if (fldr.flight_info && Array.isArray(fldr.flight_info) && fldr.flight_info.length > 0) {
    const deps = fldr.flight_info
      .map(s => parseDate(s.departure_time))
      .filter(Boolean) as Date[]
    const arrs = fldr.flight_info
      .map(s => parseDate(s.arrival_time))
      .filter(Boolean) as Date[]

    if (deps.length) start = new Date(Math.min(...deps.map(d => d.getTime())))
    if (arrs.length) end   = new Date(Math.max(...arrs.map(d => d.getTime())))
  }

  // Fall back to job dates
  if (!start) start = parseDate(fldr.date_start)
  if (!end)   end   = parseDate(fldr.date_end)
  if (!end && start) end = new Date(start)

  if (!start || !end) return null

  // Normalise to midnight
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  return { start, end }
}

function getFlightDays(fldr: Fldr): Set<string> {
  const days = new Set<string>()
  if (!fldr.flight_info || !Array.isArray(fldr.flight_info)) return days
  fldr.flight_info.forEach(seg => {
    const dep = parseDate(seg.departure_time)
    const arr = parseDate(seg.arrival_time)
    if (dep) days.add(toDateKey(dep))
    if (arr) days.add(toDateKey(arr))
  })
  return days
}

export default function CalendarPage() {
  const router = useRouter()
  const teamProfiles = getTeamProfiles()
  const [fldrs, setFldrs] = useState<Fldr[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set())
  const [jobsThisMonthOpen, setJobsThisMonthOpen] = useState(false)
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/fldrs')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setFldrs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // ── Build date → absences map ──────────────────────────────────────────────
  const absenceMap = useMemo(() => {
    const map = new Map<string, Absence[]>()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    fldrs.forEach(fldr => {
      // Skip archived jobs
      if ((fldr as any).archived) return

      const range = getJobDateRange(fldr)
      if (!range) return

      const { start, end } = range
      const isPast = end < today
      const flightDays = getFlightDays(fldr)
      const isTimeOff = (fldr as any).fldr_type === 'time_off'

      // People on this job
      const people = (fldr.people || []).map(p => p.name).filter(Boolean)
      if (people.length === 0) return

      const cur = new Date(start)
      while (cur <= end) {
        const key = toDateKey(cur)
        if (!map.has(key)) map.set(key, [])
        const dayType: 'travel' | 'work' | 'off' = isTimeOff ? 'off' : flightDays.has(key) ? 'travel' : 'work'

        people.forEach(personName => {
          const profile = teamProfiles.find(
            p => p.name.toLowerCase() === personName.toLowerCase()
          )
          const profileId = profile?.id ?? personName.toLowerCase().replace(/\s+/g, '-')

          const list = map.get(key)!
          const dupe = list.some(a => a.profileId === profileId && a.jobId === fldr.id)
          if (!dupe) {
            list.push({ personName, profileId, jobTitle: fldr.title, jobId: fldr.id, isPast, dayType })
          }
        })

        cur.setDate(cur.getDate() + 1)
      }
    })

    return map
  }, [fldrs])

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth
    const firstDow = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells: Array<{ date: Date; dateKey: string } | null> = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      cells.push({ date, dateKey: toDateKey(date) })
    }
    return cells
  }, [currentMonth])

  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const monthLabel = new Date(currentMonth.year, currentMonth.month, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' })

  const prevMonth = () =>
    setCurrentMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    )

  const nextMonth = () =>
    setCurrentMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    )

  const profileIndex = (profileId: string) => {
    const i = teamProfiles.findIndex(p => p.id === profileId)
    return i >= 0 ? i : profileId.charCodeAt(0) % DOT_COLORS.length
  }

  // ── Compute "who's out" list for current month ─────────────────────────────
  const monthAbsences = useMemo(() => {
    const byPerson = new Map<string, { 
      name: string; 
      jobs: Map<string, { 
        jobTitle: string; 
        days: string[]; 
        isPast: boolean; 
        dayType: 'travel' | 'work' | 'off';
        location: string | null;
        jobId: string;
      }>
    }>()

    calendarDays.forEach(day => {
      if (!day) return
      const absences = absenceMap.get(day.dateKey) || []
      absences.forEach(a => {
        if (!byPerson.has(a.profileId)) {
          byPerson.set(a.profileId, { name: a.personName, jobs: new Map() })
        }
        const personEntry = byPerson.get(a.profileId)!
        
        if (!personEntry.jobs.has(a.jobId)) {
          // Find the fldr to get location info
          const fldr = fldrs.find(f => f.id === a.jobId)
          const location = fldr?.location || fldr?.venue_info?.name || fldr?.venue_info?.address || null
          
          personEntry.jobs.set(a.jobId, {
            jobTitle: a.jobTitle,
            days: [],
            isPast: a.isPast,
            dayType: a.dayType,
            location,
            jobId: a.jobId,
          })
        }
        const jobEntry = personEntry.jobs.get(a.jobId)!
        jobEntry.days.push(day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
      })
    })

    return Array.from(byPerson.entries()).map(([profileId, info]) => ({
      profileId,
      name: info.name,
      jobs: Array.from(info.jobs.values()),
    }))
  }, [absenceMap, calendarDays, currentMonth, fldrs])

  // ── Compute "jobs this month" list, grouped by job instead of person ───────
  const monthJobs = useMemo(() => {
    const byJob = new Map<string, {
      jobId: string
      jobTitle: string
      dayType: 'travel' | 'work'
      isPast: boolean
      location: string | null
      people: Set<string>
      days: string[]
      firstDate: Date
    }>()

    calendarDays.forEach(day => {
      if (!day) return
      const absences = absenceMap.get(day.dateKey) || []
      absences.forEach(a => {
        if (a.dayType === 'off') return // exclude time off — jobs only
        if (!byJob.has(a.jobId)) {
          const fldr = fldrs.find(f => f.id === a.jobId)
          const location = fldr?.location || fldr?.venue_info?.name || fldr?.venue_info?.address || null
          byJob.set(a.jobId, {
            jobId: a.jobId,
            jobTitle: a.jobTitle,
            dayType: a.dayType,
            isPast: a.isPast,
            location,
            people: new Set(),
            days: [],
            firstDate: day.date,
          })
        }
        const entry = byJob.get(a.jobId)!
        entry.people.add(a.personName)
        const dayLabel = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        if (!entry.days.includes(dayLabel)) entry.days.push(dayLabel)
        if (day.date < entry.firstDate) entry.firstDate = day.date
        // Prefer the least-stale isPast so a job spanning past+future shows as current
        if (!a.isPast) entry.isPast = false
        entry.dayType = a.dayType
      })
    })

    return Array.from(byJob.values())
      .map(j => ({ ...j, people: Array.from(j.people) }))
      .sort((a, b) => a.firstDate.getTime() - b.firstDate.getTime())
  }, [absenceMap, calendarDays, fldrs])

  return (
    <div className="min-h-page text-white">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-md border-b border-line">
        <div className="flex items-center justify-between max-w-4xl mx-auto px-4 h-14">
          <button
            onClick={() => router.back()}
            className="icon-btn -ml-2"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="icon-btn" aria-label="Previous month">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-base font-semibold w-40 text-center tabular">{monthLabel}</h1>
            <button onClick={nextMonth} className="icon-btn" aria-label="Next month">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Today button */}
          <button
            onClick={() => {
              const n = new Date()
              setCurrentMonth({ year: n.getFullYear(), month: n.getMonth() })
            }}
            className="btn-secondary px-3 py-1.5 text-xs font-medium"
          >
            Today
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-5">
        {/* ── Legend — only people with something on the calendar this month ── */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
          {monthAbsences.map(({ profileId, name }) => {
            const idx = profileIndex(profileId)
            return (
              <div key={profileId} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${DOT_COLORS[idx % DOT_COLORS.length]}`} />
                <span className={`text-xs font-medium ${LEGEND_TEXT[idx % LEGEND_TEXT.length]}`}>
                  {name}
                </span>
              </div>
            )
          })}
          {monthAbsences.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="text-xs text-white/45">Past</span>
            </div>
          )}
        </div>

        {/* ── DOW headers ── */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-white/40 py-1.5">
              {d}
            </div>
          ))}
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/45 text-sm">
            Loading...
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px bg-line-strong rounded-xl overflow-hidden border border-line-strong">
            {calendarDays.map((day, i) => {
              if (!day) {
                return (
                  <div key={`pad-${i}`} className="bg-canvas min-h-[72px] md:min-h-[96px]" />
                )
              }

              const absences    = absenceMap.get(day.dateKey) || []
              const isToday     = day.date.getTime() === today.getTime()
              const isPastDay   = day.date < today

              // Unique people on this day
              const uniqueIds   = Array.from(new Set(absences.map(a => a.profileId)))

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => setSelectedDateKey(day.dateKey)}
                  className={`text-left bg-surface hover:bg-surface-raised transition-colors p-1 md:p-1.5 min-h-[72px] md:min-h-[96px] flex flex-col ${
                    isToday ? 'ring-1 ring-inset ring-gold/70' : ''
                  }`}
                >
                  {/* Day number */}
                  <div
                    className={`text-[11px] font-medium tabular mb-1 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                      isToday
                        ? 'bg-gold text-black font-bold text-xs'
                        : isPastDay
                        ? 'text-white/30'
                        : 'text-white/70'
                    }`}
                  >
                    {day.date.getDate()}
                  </div>

                  {uniqueIds.length > 0 && (
                    <div className="flex-1 overflow-hidden">
                      {/* ── Mobile: icons ── */}
                      <div className="flex flex-wrap gap-0.5 md:hidden">
                        {uniqueIds.map(pid => {
                          const absence = absences.find(a => a.profileId === pid)
                          const idx     = profileIndex(pid)
                          if (absence?.dayType === 'off') {
                            return (
                              <svg key={pid} className={`w-3 h-3 flex-shrink-0 ${absence.isPast ? 'text-white/25' : CHIP_TEXT[idx % CHIP_TEXT.length]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )
                          }
                          const Icon = absence?.dayType === 'travel' ? AirplaneIcon : BriefcaseIcon
                          return (
                            <Icon
                              key={pid}
                              className={`w-3 h-3 flex-shrink-0 ${
                                absence?.isPast
                                  ? 'text-white/25'
                                  : absence?.dayType === 'travel'
                                  ? 'text-sky-400'
                                  : CHIP_TEXT[idx % CHIP_TEXT.length]
                              }`}
                            />
                          )
                        })}
                      </div>

                      {/* ── Desktop: name chips with icon ── */}
                      <div className="hidden md:flex flex-col gap-0.5">
                        {uniqueIds.map(pid => {
                          const profile = teamProfiles.find(p => p.id === pid)
                          const name    = profile?.name ?? absences.find(a => a.profileId === pid)?.personName ?? pid
                          const absence = absences.find(a => a.profileId === pid)
                          const idx     = profileIndex(pid)

                          if (absence?.dayType === 'off') {
                            return (
                              <div
                                key={pid}
                                title="Time Off"
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight flex items-center gap-1 ${
                                  absence.isPast ? 'bg-white/5 text-white/25' : `${CHIP_BG[idx % CHIP_BG.length]} ${CHIP_TEXT[idx % CHIP_TEXT.length]}`
                                }`}
                              >
                                <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="truncate">{name}</span>
                              </div>
                            )
                          }

                          const Icon = absence?.dayType === 'travel' ? AirplaneIcon : BriefcaseIcon
                          return (
                            <div
                              key={pid}
                              title={absence?.jobTitle}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight flex items-center gap-1 ${
                                absence?.isPast
                                  ? 'bg-white/5 text-white/25'
                                  : `${CHIP_BG[idx % CHIP_BG.length]} ${CHIP_TEXT[idx % CHIP_TEXT.length]}`
                              }`}
                            >
                              <Icon className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">{name}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Jobs this month ── */}
        {!loading && monthJobs.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setJobsThisMonthOpen(o => !o)}
              className="w-full flex items-center justify-between mb-3 px-1"
            >
              <h2 className="eyebrow">
                Jobs this month ({monthJobs.length})
              </h2>
              <svg
                className={`w-4 h-4 text-white/30 transition-transform ${jobsThisMonthOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {jobsThisMonthOpen && (
              <div className="space-y-2">
                {monthJobs.map(job => {
                  const Icon = job.dayType === 'travel' ? AirplaneIcon : BriefcaseIcon

                  return (
                    <button
                      key={job.jobId}
                      onClick={() => router.push(`/jobs/${job.jobId}`)}
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                        job.isPast
                          ? 'bg-surface/60 border-line'
                          : 'bg-surface border-line hover:bg-surface-raised hover:border-line-strong'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        job.isPast
                          ? 'text-white/20'
                          : job.dayType === 'travel'
                          ? 'text-sky-400'
                          : 'text-white/60'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${job.isPast ? 'text-white/30' : 'text-white/90'}`}>
                          {job.jobTitle}
                        </div>
                        {job.location && (
                          <div className={`text-xs mt-0.5 flex items-center gap-1 ${job.isPast ? 'text-white/25' : 'text-white/50'}`}>
                            <MapPinIcon className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </div>
                        )}
                        <div className={`text-xs mt-0.5 ${job.isPast ? 'text-white/25' : 'text-white/50'}`}>
                          {job.people.join(', ')} · {job.days.length}d
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-white/20 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Month summary ── */}
        {!loading && monthAbsences.length > 0 && (
          <div className="mt-6">
            <h2 className="eyebrow mb-3 px-1">
              Out this month
            </h2>
            <div className="space-y-2">
              {monthAbsences.map(({ profileId, name, jobs }) => {
                const idx = profileIndex(profileId)
                const isExpanded = expandedPeople.has(profileId)
                const totalDays = jobs.reduce((sum, job) => sum + job.days.length, 0)
                const allPast = jobs.every(j => j.isPast)
                
                return (
                  <div
                    key={profileId}
                    className="bg-surface rounded-xl border border-line overflow-hidden"
                  >
                    {/* Clickable header - minimal info */}
                    <button
                      onClick={() => {
                        setExpandedPeople(prev => {
                          const next = new Set(prev)
                          if (next.has(profileId)) {
                            next.delete(profileId)
                          } else {
                            next.add(profileId)
                          }
                          return next
                        })
                      }}
                      className="w-full px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_COLORS[idx % DOT_COLORS.length]} ${
                            allPast ? 'opacity-40' : ''
                          }`}
                        />
                        <span className={`text-sm font-semibold truncate ${
                          allPast ? 'text-white/30' : LEGEND_TEXT[idx % LEGEND_TEXT.length]
                        }`}>
                          {name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-semibold ${
                          allPast ? 'text-white/20' : 'text-white/40'
                        }`}>
                          {totalDays}d
                        </span>
                        {/* Chevron icon */}
                        <svg
                          className={`w-4 h-4 text-white/30 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expandable job details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 space-y-2 border-t border-line">
                        {jobs.map((job, jobIdx) => {
                          const Icon = job.dayType === 'off' 
                            ? (props: any) => (
                                <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )
                            : job.dayType === 'travel' 
                            ? AirplaneIcon 
                            : BriefcaseIcon

                          return (
                            <div key={`${job.jobId}-${jobIdx}`} className="flex items-start gap-2 pl-4">
                              <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                                job.isPast 
                                  ? 'text-white/20' 
                                  : job.dayType === 'travel'
                                  ? 'text-sky-400'
                                  : job.dayType === 'off'
                                  ? LEGEND_TEXT[idx % LEGEND_TEXT.length]
                                  : 'text-white/50'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                  <span className={`text-sm font-medium ${
                                    job.isPast ? 'text-white/25' : 'text-white/90'
                                  }`}>
                                    {job.dayType === 'off' ? 'Time Off' : job.jobTitle}
                                  </span>
                                  <span className={`text-xs font-semibold flex-shrink-0 ${
                                    job.isPast ? 'text-white/20' : 'text-white/40'
                                  }`}>
                                    {job.days.length}d
                                  </span>
                                </div>
                                {job.dayType !== 'off' && job.location && (
                                  <div className={`text-xs ${job.isPast ? 'text-white/25' : 'text-white/50'} mt-0.5 flex items-center gap-1`}>
                                    <MapPinIcon className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{job.location}</span>
                                  </div>
                                )}
                                <div className={`text-xs ${job.isPast ? 'text-white/20' : 'text-white/30'} mt-1 leading-relaxed`}>
                                  {job.days.slice(0, 6).join(' · ')}
                                  {job.days.length > 6 && ` · +${job.days.length - 6} more`}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && monthAbsences.length === 0 && (
          <p className="text-center text-white/40 text-sm mt-8">
            No one out this month
          </p>
        )}
      </div>

      {/* ── Day detail modal ── */}
      {selectedDateKey && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in"
          onClick={() => setSelectedDateKey(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-surface border border-line-strong rounded-t-3xl md:rounded-2xl w-full md:max-w-md max-h-[80vh] overflow-y-auto shadow-pop animate-sheet-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-surface border-b border-line pl-5 pr-3 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {parseDate(selectedDateKey)?.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
              <button
                onClick={() => setSelectedDateKey(null)}
                className="icon-btn"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3 space-y-2">
              {(() => {
                const absences = absenceMap.get(selectedDateKey) || []
                if (absences.length === 0) {
                  return (
                    <p className="text-center text-white/40 text-sm py-6">
                      Nothing scheduled
                    </p>
                  )
                }

                // Group by job so each job/time-off shows once with all its people
                const byJob = new Map<string, { jobId: string; jobTitle: string; dayType: Absence['dayType']; isPast: boolean; people: string[] }>()
                absences.forEach(a => {
                  const key = `${a.jobId}-${a.dayType}`
                  if (!byJob.has(key)) {
                    byJob.set(key, { jobId: a.jobId, jobTitle: a.jobTitle, dayType: a.dayType, isPast: a.isPast, people: [] })
                  }
                  byJob.get(key)!.people.push(a.personName)
                })

                return Array.from(byJob.values()).map((job, idx) => {
                  const Icon = job.dayType === 'off'
                    ? (props: any) => (
                        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )
                    : job.dayType === 'travel'
                    ? AirplaneIcon
                    : BriefcaseIcon

                  const fldr = fldrs.find(f => f.id === job.jobId)
                  const location = fldr?.location || fldr?.venue_info?.name || fldr?.venue_info?.address || null
                  const isClickable = job.dayType !== 'off'

                  return (
                    <button
                      key={`${job.jobId}-${job.dayType}-${idx}`}
                      type="button"
                      disabled={!isClickable}
                      onClick={() => {
                        if (!isClickable) return
                        setSelectedDateKey(null)
                        router.push(`/jobs/${job.jobId}`)
                      }}
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border border-line bg-canvas/40 transition-colors ${
                        isClickable ? 'hover:bg-white/5 active:bg-white/10 cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        job.dayType === 'travel' ? 'text-sky-400' : job.dayType === 'off' ? 'text-purple-300' : 'text-white/60'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white/90">
                          {job.dayType === 'off' ? 'Time Off' : job.jobTitle}
                        </div>
                        {location && job.dayType !== 'off' && (
                          <div className="text-xs text-white/50 mt-0.5 flex items-center gap-1"><MapPinIcon className="w-3 h-3 flex-shrink-0" /><span className="truncate">{location}</span></div>
                        )}
                        <div className="text-xs text-white/50 mt-1">
                          {job.people.join(', ')}
                        </div>
                      </div>
                      {isClickable && (
                        <svg className="w-4 h-4 text-white/20 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
