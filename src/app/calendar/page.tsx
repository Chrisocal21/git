'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fldr } from '@/types/fldr'
import { getTeamProfiles } from '@/lib/auth'
import { getOwnFlights } from '@/lib/tripSpan'
import { AirplaneIcon, AlertIcon, BriefcaseIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, CloseIcon, PencilIcon, TravelWorkIcon, MapPinIcon } from '@/components/Icons'
import PageHeader from '@/components/PageHeader'
import TimeOffForm from '@/components/TimeOffForm'
import { applyJobsChange, onJobsChanged } from '@/lib/jobsChanged'

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

type DayType = 'travel' | 'work' | 'off' | 'travel_work'

/**
 * Combine one person's entries for a day. Flight = plane; no flight = briefcase;
 * flight while also inside a job's work window (their own or a second job's) = both.
 */
function mergeDay(entries: Absence[]): Absence | undefined {
  if (entries.length === 0) return undefined
  const off = entries.find(a => a.dayType === 'off')
  if (off) return off
  const hasFlight = entries.some(a => a.dayType === 'travel')
  const hasWork = entries.some(a => a.dayType === 'work')
  const jobsInRange = new Set(entries.filter(a => a.inJobRange).map(a => a.jobId)).size
  const dayType: DayType = hasFlight && (hasWork || jobsInRange >= 2) ? 'travel_work' : hasFlight ? 'travel' : 'work'
  return { ...entries[0], dayType, isPast: entries.every(a => a.isPast) }
}

function dayIcon(t: DayType | undefined) {
  return t === 'travel' ? AirplaneIcon : t === 'travel_work' ? TravelWorkIcon : BriefcaseIcon
}

interface Absence {
  profileId: string
  personName: string
  jobTitle: string
  jobId: string
  isPast: boolean
  dayType: DayType
  inJobRange: boolean
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

function getJobDateRange(fldr: Fldr, all: Fldr[], person: string): { start: Date; end: Date } | null {
  let start: Date | null = null
  let end: Date | null = null

  // Prefer flight times for precision (onward flights to another job count departure only)
  const flights = getOwnFlights(fldr, all, person)
  if (flights.length > 0) {
    const deps = flights
      .map(s => parseDate(s.departure_time))
      .filter(Boolean) as Date[]
    const arrs = flights
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

function getFlightDays(fldr: Fldr, all: Fldr[], person: string): Set<string> {
  const days = new Set<string>()
  getOwnFlights(fldr, all, person).forEach(seg => {
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
  // The time off being added (a day) or changed (an entry), in its own sheet
  const [timeOff, setTimeOff] = useState<{ entry: Fldr | null; day: string | null } | null>(null)
  // The server couldn't be reached and this phone has nothing saved to show instead
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    // The jobs list this phone keeps (the Jobs page and the time off form both write to it)
    const readCache = (): Fldr[] => {
      try {
        const cached = JSON.parse(localStorage.getItem('git-fldrs') || '[]')
        return Array.isArray(cached) ? cached : []
      } catch {
        return []
      }
    }

    // What this phone already has shows straight away, and stays if the server can't be reached
    const cached = readCache()
    if (cached.length > 0) {
      setFldrs(cached)
      setLoading(false)
    }

    const load = () =>
      fetch('/api/fldrs', { cache: 'no-store' })
        .then(r => {
          if (!r.ok) throw new Error(`load failed: ${r.status}`)
          return r.json()
        })
        .then(data => {
          // With no signal an empty list can come back in place of the real one,
          // so an empty answer never replaces what this phone already knows
          setFldrs(Array.isArray(data) && data.length > 0 ? data : readCache())
          setLoadFailed(false)
          setLoading(false)
        })
        .catch(() => {
          const kept = readCache()
          if (kept.length > 0) setFldrs(kept)
          else setLoadFailed(true)
          setLoading(false)
        })

    load()
    // Time off added from the dock, or changed in the sheet here: on the calendar straight away,
    // then loaded again to be sure it matches the server
    return onJobsChanged(change => {
      setFldrs(current => applyJobsChange(current, change))
      load()
    })
  }, [])

  // ── Build date → absences map ──────────────────────────────────────────────
  const absenceMap = useMemo(() => {
    const map = new Map<string, Absence[]>()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    fldrs.forEach(fldr => {
      // Skip archived jobs
      if ((fldr as any).archived) return

      const isTimeOff = (fldr as any).fldr_type === 'time_off'

      // People on this job
      const people = (fldr.people || []).map(p => p.name).filter(Boolean)
      if (people.length === 0) return

      // Each person gets their own range, based only on flights they're on
      people.forEach(personName => {
        const range = getJobDateRange(fldr, fldrs, personName)
        if (!range) return

        const { start, end } = range
        const isPast = end < today
        const flightDays = getFlightDays(fldr, fldrs, personName)
        // Job's own date window (flights can extend a person's range beyond it)
        const jobStart = parseDate(fldr.date_start)
        const jobEnd = parseDate(fldr.date_end) ?? jobStart
        const jobStartKey = jobStart ? toDateKey(jobStart) : ''
        const jobEndKey = jobEnd ? toDateKey(jobEnd) : ''

        const profile = teamProfiles.find(
          p => p.name.toLowerCase() === personName.toLowerCase()
        )
        const profileId = profile?.id ?? personName.toLowerCase().replace(/\s+/g, '-')

        const cur = new Date(start)
        while (cur <= end) {
          const key = toDateKey(cur)
          if (!map.has(key)) map.set(key, [])
          const dayType: DayType = isTimeOff ? 'off' : flightDays.has(key) ? 'travel' : 'work'

          const list = map.get(key)!
          const dupe = list.some(a => a.profileId === profileId && a.jobId === fldr.id)
          if (!dupe) {
            const inJobRange = key >= jobStartKey && key <= jobEndKey
            list.push({ personName, profileId, jobTitle: fldr.title, jobId: fldr.id, isPast, dayType, inJobRange })
          }

          cur.setDate(cur.getDate() + 1)
        }
      })
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
        dayType: DayType;
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
      dayType: DayType
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
      {/* ── Header: the page's own back button, like every other page ── */}
      <PageHeader
        title="Team Calendar"
        width="max-w-4xl"
        actions={
          <button
            onClick={() => {
              const n = new Date()
              setCurrentMonth({ year: n.getFullYear(), month: n.getMonth() })
            }}
            className="btn-secondary min-h-[2.5rem] px-3.5 font-medium"
          >
            Today
          </button>
        }
      />

      <div className="max-w-4xl mx-auto px-4 pt-3">
        {/* ── Month: its arrows sit either side of its name, well away from Back ── */}
        <div className="mb-3 flex items-center justify-between">
          <button onClick={prevMonth} className="icon-btn h-11 w-11" aria-label="Previous month">
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-center tabular">{monthLabel}</h2>
          <button onClick={nextMonth} className="icon-btn h-11 w-11" aria-label="Next month">
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

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
            <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-white/45 py-1.5">
              {d}
            </div>
          ))}
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/45 text-sm">
            Loading the calendar...
          </div>
        ) : loadFailed ? (
          <div className="py-16 text-center">
            <AlertIcon className="mx-auto mb-3 h-7 w-7 text-amber-300" />
            <p className="font-semibold text-white">Couldn&apos;t load the calendar</p>
            <p className="mt-1.5 mb-6 text-sm leading-relaxed text-white/55">Check your connection, then try again.</p>
            <button onClick={() => window.location.reload()} className="btn-brand min-h-[2.75rem] px-6">
              Try Again
            </button>
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
                    className={`text-xs font-medium tabular mb-1 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
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
                          const absence = mergeDay(absences.filter(a => a.profileId === pid))
                          const idx     = profileIndex(pid)
                          if (absence?.dayType === 'off') {
                            return (
                              <ClockIcon key={pid} className={`w-3.5 h-3.5 flex-shrink-0 ${absence.isPast ? 'text-white/25' : CHIP_TEXT[idx % CHIP_TEXT.length]}`} />
                            )
                          }
                          const Icon = dayIcon(absence?.dayType)
                          return (
                            <Icon
                              key={pid}
                              className={`w-3.5 h-3.5 flex-shrink-0 ${
                                absence?.isPast
                                  ? 'text-white/25'
                                  : (absence?.dayType === 'travel' || absence?.dayType === 'travel_work')
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
                          const absence = mergeDay(absences.filter(a => a.profileId === pid))
                          const idx     = profileIndex(pid)

                          if (absence?.dayType === 'off') {
                            return (
                              <div
                                key={pid}
                                title="Time Off"
                                className={`px-1.5 py-0.5 rounded text-[11px] font-medium leading-tight flex items-center gap-1 ${
                                  absence.isPast ? 'bg-white/5 text-white/25' : `${CHIP_BG[idx % CHIP_BG.length]} ${CHIP_TEXT[idx % CHIP_TEXT.length]}`
                                }`}
                              >
                                <ClockIcon className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{name}</span>
                              </div>
                            )
                          }

                          const Icon = dayIcon(absence?.dayType)
                          return (
                            <div
                              key={pid}
                              title={absence?.jobTitle}
                              className={`px-1.5 py-0.5 rounded text-[11px] font-medium leading-tight flex items-center gap-1 ${
                                absence?.isPast
                                  ? 'bg-white/5 text-white/25'
                                  : `${CHIP_BG[idx % CHIP_BG.length]} ${CHIP_TEXT[idx % CHIP_TEXT.length]}`
                              }`}
                            >
                              <Icon className="w-3 h-3 flex-shrink-0" />
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
              aria-expanded={jobsThisMonthOpen}
              className="w-full min-h-[2.75rem] flex items-center justify-between mb-1 px-1"
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
                  const Icon = dayIcon(job.dayType)

                  return (
                    <button
                      key={job.jobId}
                      onClick={() => router.push(`/jobs/${job.jobId}`)}
                      className={`w-full min-h-[3.25rem] text-left flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                        job.isPast
                          ? 'bg-surface/60 border-line'
                          : 'bg-surface border-line hover:bg-surface-raised hover:border-line-strong'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        job.isPast
                          ? 'text-white/20'
                          : (job.dayType === 'travel' || job.dayType === 'travel_work')
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
                          {job.people.join(', ')} · {job.days.length} {job.days.length === 1 ? 'day' : 'days'}
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
                      aria-expanded={isExpanded}
                      className="w-full min-h-[2.75rem] px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors"
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
                          {totalDays} {totalDays === 1 ? 'day' : 'days'}
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
                          const Icon = job.dayType === 'off' ? ClockIcon : dayIcon(job.dayType)
                          const entry = fldrs.find(f => f.id === job.jobId) || null

                          return (
                            <button
                              key={`${job.jobId}-${jobIdx}`}
                              type="button"
                              // Time off opens to be changed; a job opens its page
                              onClick={() => (job.dayType === 'off' ? setTimeOff({ entry, day: null }) : router.push(`/jobs/${job.jobId}`))}
                              className="-mx-1 flex w-[calc(100%+0.5rem)] min-h-[2.75rem] items-start gap-2 rounded-lg py-1.5 pl-4 pr-1 text-left transition-colors hover:bg-white/5"
                            >
                              <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                                job.isPast 
                                  ? 'text-white/20' 
                                  : (job.dayType === 'travel' || job.dayType === 'travel_work')
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
                                    {job.days.length} {job.days.length === 1 ? 'day' : 'days'}
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
                              {job.dayType === 'off' ? (
                                <PencilIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/30" />
                              ) : (
                                <ChevronRightIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/20" />
                              )}
                            </button>
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

        {!loading && !loadFailed && monthAbsences.length === 0 && (
          <p className="text-center text-white/45 text-sm mt-8">
            No one out this month
          </p>
        )}

        {!loading && !loadFailed && (
          <p className="mt-6 px-1 text-center text-[13px] leading-relaxed text-white/40">
            Tap a day to see who&apos;s out, or to add time off or a job on it.
          </p>
        )}
      </div>

      {/* ── Time off: add one, or change or delete one that's there ── */}
      {timeOff && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in"
          onClick={() => setTimeOff(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Time Off"
            className="bg-surface border border-line-strong rounded-t-3xl md:rounded-2xl w-full md:max-w-md max-h-[92dvh] overflow-y-auto p-6 pb-8 shadow-pop animate-sheet-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{timeOff.entry ? 'Change Time Off' : 'Time Off'}</h2>
              <button onClick={() => setTimeOff(null)} className="icon-btn h-11 w-11 -mr-2.5" aria-label="Close">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <TimeOffForm entry={timeOff.entry} defaultDay={timeOff.day} onDone={() => setTimeOff(null)} />
          </div>
        </div>
      )}

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
                className="icon-btn h-11 w-11"
                aria-label="Close"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 space-y-2">
              {(() => {
                const absences = absenceMap.get(selectedDateKey) || []
                if (absences.length === 0) {
                  return (
                    <p className="text-center text-white/45 text-sm py-6">
                      Nothing on this day yet
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
                  const isOff = job.dayType === 'off'
                  const Icon = isOff ? ClockIcon : dayIcon(job.dayType)

                  const fldr = fldrs.find(f => f.id === job.jobId)
                  const location = fldr?.location || fldr?.venue_info?.name || fldr?.venue_info?.address || null

                  return (
                    <button
                      key={`${job.jobId}-${job.dayType}-${idx}`}
                      type="button"
                      onClick={() => {
                        setSelectedDateKey(null)
                        // Time off opens to be changed or deleted; a job opens its page
                        if (isOff) setTimeOff({ entry: fldr || null, day: null })
                        else router.push(`/jobs/${job.jobId}`)
                      }}
                      className="w-full min-h-[3.25rem] text-left flex items-start gap-3 p-3 rounded-xl border border-line bg-canvas/40 transition-colors hover:bg-white/5 active:bg-white/10"
                    >
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        (job.dayType === 'travel' || job.dayType === 'travel_work') ? 'text-sky-400' : isOff ? 'text-purple-300' : 'text-white/60'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-medium text-white/90">
                          {isOff ? 'Time Off' : job.jobTitle}
                        </div>
                        {location && job.dayType !== 'off' && (
                          <div className="text-xs text-white/50 mt-0.5 flex items-center gap-1"><MapPinIcon className="w-3 h-3 flex-shrink-0" /><span className="truncate">{location}</span></div>
                        )}
                        <div className="text-[13px] text-white/55 mt-1">
                          {job.people.join(', ')}
                          {isOff && fldr?.notes ? ` · ${fldr.notes}` : ''}
                        </div>
                      </div>
                      {isOff ? (
                        <PencilIcon className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
                      ) : (
                        <ChevronRightIcon className="w-4 h-4 text-white/20 flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  )
                })
              })()}
            </div>

            {/* Start something on the day that was tapped */}
            <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
              <button
                type="button"
                onClick={() => {
                  const day = selectedDateKey
                  setSelectedDateKey(null)
                  setTimeOff({ entry: null, day })
                }}
                className="btn-secondary min-h-[2.75rem] font-medium"
              >
                + Time Off
              </button>
              <button
                type="button"
                onClick={() => router.push(`/jobs/create?date=${selectedDateKey}`)}
                className="btn-secondary min-h-[2.75rem] font-medium"
              >
                + New Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
