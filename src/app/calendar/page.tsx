'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fldr } from '@/types/fldr'
import { getTeamProfiles } from '@/lib/auth'
import { AirplaneIcon, BriefcaseIcon } from '@/components/Icons'

// Per-profile color palette (index matches TEAM_PROFILES order)
const DOT_COLORS   = ['bg-blue-500',    'bg-emerald-500', 'bg-purple-500',  'bg-orange-500']
const CHIP_BG      = ['bg-blue-500/20', 'bg-emerald-500/20', 'bg-purple-500/20', 'bg-orange-500/20']
const CHIP_TEXT    = ['text-blue-300',  'text-emerald-300',  'text-purple-300',  'text-orange-300']
const LEGEND_TEXT  = ['text-blue-400',  'text-emerald-400',  'text-purple-400',  'text-orange-400']

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
    const byPerson = new Map<string, { name: string; days: string[]; isPast: boolean; dayTypes: Set<'travel' | 'work' | 'off'> }>()

    calendarDays.forEach(day => {
      if (!day) return
      const absences = absenceMap.get(day.dateKey) || []
      absences.forEach(a => {
        if (!byPerson.has(a.profileId)) {
          byPerson.set(a.profileId, { name: a.personName, days: [], isPast: a.isPast, dayTypes: new Set() })
        }
        const entry = byPerson.get(a.profileId)!
        entry.days.push(day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
        entry.dayTypes.add(a.dayType)
      })
    })

    return Array.from(byPerson.entries()).map(([profileId, info]) => ({
      profileId,
      name: info.name,
      days: info.days,
      isPast: info.isPast,
      dayTypes: Array.from(info.dayTypes) as ('travel' | 'work' | 'off')[],
    }))
  }, [absenceMap, calendarDays, currentMonth])

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white pb-24">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#1a1a1a]/95 backdrop-blur-sm border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between max-w-4xl mx-auto px-4 py-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-base font-semibold w-44 text-center">{monthLabel}</h1>
            <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
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
            className="text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            Today
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 pt-4">
        {/* ── Legend ── */}
        <div className="flex flex-wrap gap-3 mb-4 px-1">
          {teamProfiles.map((profile, i) => (
            <div key={profile.id} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`} />
              <span className={`text-xs font-medium ${LEGEND_TEXT[i % LEGEND_TEXT.length]}`}>
                {profile.name}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="text-xs text-white/30">Past</span>
          </div>
        </div>

        {/* ── DOW headers ── */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="text-center text-[11px] text-white/30 font-medium py-1">
              {d}
            </div>
          ))}
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/30 text-sm">
            Loading...
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px bg-[#2a2a2a] rounded-lg overflow-hidden border border-[#2a2a2a]">
            {calendarDays.map((day, i) => {
              if (!day) {
                return (
                  <div key={`pad-${i}`} className="bg-[#181818] min-h-[72px] md:min-h-[96px]" />
                )
              }

              const absences    = absenceMap.get(day.dateKey) || []
              const isToday     = day.date.getTime() === today.getTime()
              const isPastDay   = day.date < today

              // Unique people on this day
              const uniqueIds   = Array.from(new Set(absences.map(a => a.profileId)))

              return (
                <div
                  key={day.dateKey}
                  className={`bg-[#1f1f1f] p-1 md:p-1.5 min-h-[72px] md:min-h-[96px] flex flex-col ${
                    isToday ? 'ring-1 ring-inset ring-[#E8B44D]/60' : ''
                  }`}
                >
                  {/* Day number */}
                  <div
                    className={`text-[11px] font-medium mb-1 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                      isToday
                        ? 'bg-[#E8B44D] text-black font-bold text-xs'
                        : isPastDay
                        ? 'text-white/20'
                        : 'text-white/60'
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
                </div>
              )
            })}
          </div>
        )}

        {/* ── Month summary ── */}
        {!loading && monthAbsences.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 px-1">
              Out this month
            </h2>
            <div className="space-y-2">
              {monthAbsences.map(({ profileId, name, days, isPast, dayTypes }) => {
                const idx = profileIndex(profileId)
                return (
                  <div
                    key={profileId}
                    className="flex items-start gap-3 px-3 py-2.5 bg-[#1f1f1f] rounded-lg border border-[#2a2a2a]"
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
                        isPast ? 'bg-white/20' : DOT_COLORS[idx % DOT_COLORS.length]
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium flex items-center gap-1.5 ${isPast ? 'text-white/30' : LEGEND_TEXT[idx % LEGEND_TEXT.length]}`}>
                        {name}
                        <span className="flex items-center gap-1">
                          {dayTypes.includes('travel') && (
                            <AirplaneIcon className={`w-3.5 h-3.5 ${isPast ? 'text-white/20' : 'text-sky-400'}`} />
                          )}
                          {dayTypes.includes('work') && (
                            <BriefcaseIcon className={`w-3.5 h-3.5 ${isPast ? 'text-white/20' : 'opacity-70'}`} />
                          )}
                          {dayTypes.includes('off') && (
                            <svg className={`w-3.5 h-3.5 ${isPast ? 'text-white/20' : LEGEND_TEXT[idx % LEGEND_TEXT.length]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </span>
                      </div>
                      <div className="text-xs text-white/30 mt-0.5 leading-relaxed">
                        {days.slice(0, 6).join(' · ')}
                        {days.length > 6 && ` · +${days.length - 6} more`}
                      </div>
                    </div>
                    <div className={`text-xs font-semibold flex-shrink-0 ${isPast ? 'text-white/20' : 'text-white/50'}`}>
                      {days.length}d
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && monthAbsences.length === 0 && (
          <p className="text-center text-white/20 text-sm mt-8">
            No one out this month
          </p>
        )}
      </div>
    </div>
  )
}
