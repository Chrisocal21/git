'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fldr } from '@/types/fldr'
import { WeatherSVG } from '@/components/WeatherIcon'

interface JobWeather {
  fldrId: string
  fldrTitle: string
  clientName: string | null
  location: string
  dateStart: string
  dateEnd: string | null
  timezone: string | null
  current: {
    temp: number
    feels_like: number
    description: string
    main: string
    humidity: number
    wind_speed: number
  } | null
  daily: Array<{
    date: string
    high: number
    low: number
    main: string
    description: string
    pop: number
  }>
  loading: boolean
  error?: boolean
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDay(dateStr: string) {
  const today = new Date().toISOString().split('T')[0]
  if (dateStr === today) return 'Today'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function getLocalTime(timezone: string | null): string {
  if (!timezone) return ''
  try {
    return new Date().toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return ''
  }
}

function isFutureOrCurrent(dateStr: string) {
  const jobDate = new Date(dateStr + 'T23:59:00')
  return jobDate >= new Date()
}

export default function WeatherPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<JobWeather[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      let fldrs: Fldr[] = []
      try {
        const res = await fetch('/api/fldrs')
        if (res.ok) fldrs = await res.json()
      } catch {
        const cached = localStorage.getItem('git-fldrs')
        if (cached) fldrs = JSON.parse(cached)
      }

      // Filter to upcoming jobs with a location
      const myFldrs = fldrs
        .filter(f => !f.archived && f.job_status !== 'complete')
        .filter(f => isFutureOrCurrent(f.date_end || f.date_start))
        .filter(f => f.location || f.venue_info?.address)
        .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())

      // Build initial job list with loading states
      const initial: JobWeather[] = myFldrs.map(f => ({
        fldrId: f.id,
        fldrTitle: f.title,
        clientName: f.job_info?.client_name || null,
        location: f.location || f.venue_info?.address || '',
        dateStart: f.date_start,
        dateEnd: f.date_end || null,
        timezone: null,
        current: null,
        daily: [],
        loading: true,
      }))

      setJobs(initial)
      setLoading(false)

      // Fetch weather for each job in parallel
      initial.forEach((job, idx) => {
        fetch(`/api/weather?location=${encodeURIComponent(job.location)}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            setJobs(prev => prev.map((j, i) => i !== idx ? j : {
              ...j,
              loading: false,
              timezone: d?.timezone ?? null,
              current: d?.current ?? null,
              daily: d?.daily ?? [],
              error: !d?.current,
            }))
          })
          .catch(() => {
            setJobs(prev => prev.map((j, i) => i !== idx ? j : { ...j, loading: false, error: true }))
          })
      })
    }

    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-b from-[#0a0a0a] to-transparent z-10 px-4 pt-5 pb-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Job Weather</h1>
            <p className="text-xs text-white/40 mt-0.5">Current weather at destinations</p>
          </div>
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="px-4 space-y-3 max-w-lg mx-auto">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-52 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="text-center py-20">
            <svg className="w-12 h-12 text-white/20 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <p className="text-white/40 text-sm">No upcoming jobs with locations</p>
          </div>
        )}

        {jobs.map(job => (
          <button
            key={job.fldrId}
            onClick={() => router.push(`/jobs/${job.fldrId}`)}
            className="w-full text-left rounded-2xl overflow-hidden bg-gradient-to-br from-[#1c3a4a] to-[#0d2133] border border-white/5 shadow-lg active:scale-[0.98] transition-transform"
          >
            {/* Card header */}
            <div className="px-4 pt-4 pb-3 border-b border-white/5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-[#E8B44D]/80 uppercase tracking-widest font-medium truncate">
                  {job.clientName || job.location}
                </div>
                <div className="text-base font-semibold text-white leading-tight truncate mt-0.5">
                  {job.location}
                </div>
                <div className="text-xs text-white/40 mt-1">
                  <span className="text-white/25 uppercase tracking-wider text-[10px] mr-1">Trip</span>
                  {formatDate(job.dateStart)}{job.dateEnd && job.dateEnd !== job.dateStart ? ` – ${formatDate(job.dateEnd)}` : ''}
                </div>                {job.timezone && (
                  <div className="text-xs text-white/30 mt-0.5">
                    <span className="text-white/20 uppercase tracking-wider text-[10px] mr-1">Local</span>
                    {getLocalTime(job.timezone)}
                  </div>
                )}              </div>

              {/* Current temp */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {job.loading ? (
                  <div className="w-9 h-9 rounded-full bg-white/10 animate-pulse" />
                ) : job.current ? (
                  <>
                    <WeatherSVG condition={job.current.main} size="sm" />
                    <span className="text-3xl font-thin text-white leading-none">{Math.round(job.current.temp)}°</span>
                  </>
                ) : (
                  <span className="text-sm text-white/30">—</span>
                )}
              </div>
            </div>

            {/* Current details */}
            {job.current && !job.loading && (
              <div className="px-4 py-2.5 flex items-center gap-4 text-xs text-white/50">
                <span className="capitalize">{job.current.description}</span>
                <span>·</span>
                <span>Feels {Math.round(job.current.feels_like)}°</span>
                <span>·</span>
                <span>{job.current.humidity}% humidity</span>
                <span>·</span>
                <span>{job.current.wind_speed} mph</span>
              </div>
            )}

            {/* 5-day forecast strip */}
            {!job.loading && job.daily.length > 0 && (
              <div className="grid grid-cols-5 gap-px bg-white/[0.04] border-t border-white/5">
                {job.daily.map(day => (
                  <div key={day.date} className="bg-[#0d2133] py-2.5 flex flex-col items-center gap-1">
                    <div className="text-[10px] text-white/40">{formatDay(day.date)}</div>
                    <WeatherSVG condition={day.main} size="xs" />
                    <div className="text-xs font-semibold text-white">{day.high}°</div>
                    <div className="text-[10px] text-white/35">{day.low}°</div>
                    {day.pop > 20 && (
                      <div className="text-[9px] text-blue-300">{day.pop}%</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {job.loading && (
              <div className="h-24 flex items-center justify-center">
                <div className="text-xs text-white/30">Loading weather…</div>
              </div>
            )}

            {!job.loading && job.error && (
              <div className="h-16 flex items-center justify-center">
                <div className="text-xs text-white/20">Weather unavailable</div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
