'use client'

import { useEffect, useState } from 'react'

interface WeatherApiResponse {
  location: { name: string; state: string | null; country: string }
  current: {
    temp: number
    feels_like: number
    description: string
    main: string
    humidity: number
    wind_speed: number
  }
  daily: Array<{
    date: string
    temp: number
    low: number
    high: number
    main: string
    description: string
    pop: number
  }>
  alerts?: Array<{ event: string; description: string }>
}

// Shared SVG weather icons — stroke-based, no external dependencies
export function WeatherSVG({ condition, size = 'md' }: { condition: string; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const c = condition.toLowerCase()
  const cls = size === 'xs' ? 'w-5 h-5' : size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-16 h-16' : 'w-10 h-10'

  if (c.includes('thunder') || c.includes('storm')) {
    return (
      <svg className={cls} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
        <path d="M46 28a12 12 0 0 0-23.8-2.4A10 10 0 1 0 9 36H46a10 10 0 0 0 0-20z" stroke="#94a3b8"/>
        <path d="M32 42l-5 11h8l-5 11" stroke="#fbbf24" strokeWidth="3"/>
      </svg>
    )
  }
  if (c.includes('snow') || c.includes('sleet') || c.includes('blizzard')) {
    return (
      <svg className={cls} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
        <path d="M46 28a12 12 0 0 0-23.8-2.4A10 10 0 1 0 9 36H46a10 10 0 0 0 0-20z" stroke="#94a3b8"/>
        {[17, 27, 37, 47].map(x => (
          <g key={x} stroke="#a5f3fc">
            <line x1={x} y1="43" x2={x} y2="53"/>
            <line x1={x - 3} y1="46" x2={x + 3} y2="46"/>
            <line x1={x - 3} y1="50" x2={x + 3} y2="50"/>
          </g>
        ))}
      </svg>
    )
  }
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) {
    return (
      <svg className={cls} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
        <path d="M46 28a12 12 0 0 0-23.8-2.4A10 10 0 1 0 9 36H46a10 10 0 0 0 0-20z" stroke="#94a3b8"/>
        <line x1="17" y1="43" x2="14" y2="52" stroke="#93c5fd"/>
        <line x1="27" y1="43" x2="24" y2="52" stroke="#93c5fd"/>
        <line x1="37" y1="43" x2="34" y2="52" stroke="#93c5fd"/>
        <line x1="47" y1="43" x2="44" y2="52" stroke="#93c5fd"/>
      </svg>
    )
  }
  if (c.includes('fog') || c.includes('mist') || c.includes('haze') || c.includes('smoke')) {
    return (
      <svg className={cls} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
        <path d="M44 25a12 12 0 0 0-23.8-2.4A10 10 0 1 0 7 33H44a10 10 0 0 0 0-20z" stroke="#94a3b8"/>
        <line x1="10" y1="42" x2="42" y2="42" stroke="#6b7280"/>
        <line x1="14" y1="49" x2="46" y2="49" stroke="#6b7280"/>
        <line x1="10" y1="56" x2="36" y2="56" stroke="#6b7280"/>
      </svg>
    )
  }
  if (c.includes('overcast') || (c.includes('cloud') && !c.includes('partly') && !c.includes('few') && !c.includes('scatter') && !c.includes('broken'))) {
    return (
      <svg className={cls} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
        <path d="M50 38a12 12 0 0 0-23.8-2.4A10 10 0 1 0 13 46H50a10 10 0 0 0 0-20z" stroke="#94a3b8"/>
        <path d="M36 26a10 10 0 0 0-19.8-2A8 8 0 1 0 5 32H36a8 8 0 0 0 0-16z" stroke="#64748b" opacity="0.5"/>
      </svg>
    )
  }
  if (c.includes('cloud') || c.includes('partly') || c.includes('few') || c.includes('scatter') || c.includes('broken')) {
    return (
      <svg className={cls} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
        <g stroke="#fbbf24">
          <circle cx="44" cy="20" r="10" fill="none"/>
          <line x1="44" y1="5" x2="44" y2="10"/>
          <line x1="44" y1="30" x2="44" y2="35"/>
          <line x1="29" y1="20" x2="34" y2="20"/>
          <line x1="54" y1="20" x2="59" y2="20"/>
          <line x1="33" y1="9" x2="37" y2="13"/>
          <line x1="51" y1="27" x2="55" y2="31"/>
        </g>
        <path d="M40 40a11 11 0 0 0-21.8-2.2A9 9 0 1 0 5 47H40a9 9 0 0 0 0-18z" stroke="#93c5fd"/>
      </svg>
    )
  }
  if (c.includes('clear') || c.includes('sunny')) {
    return (
      <svg className={cls} fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="12"/>
        <line x1="32" y1="5" x2="32" y2="14"/>
        <line x1="32" y1="50" x2="32" y2="59"/>
        <line x1="5" y1="32" x2="14" y2="32"/>
        <line x1="50" y1="32" x2="59" y2="32"/>
        <line x1="13" y1="13" x2="19.5" y2="19.5"/>
        <line x1="44.5" y1="44.5" x2="51" y2="51"/>
        <line x1="51" y1="13" x2="44.5" y2="19.5"/>
        <line x1="19.5" y1="44.5" x2="13" y2="51"/>
      </svg>
    )
  }
  // Default: partly cloudy
  return (
    <svg className={cls} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
      <g stroke="#fbbf24">
        <circle cx="44" cy="20" r="10" fill="none"/>
        <line x1="44" y1="6" x2="44" y2="10"/>
        <line x1="55" y1="20" x2="59" y2="20"/>
        <line x1="33" y1="9" x2="37" y2="13"/>
      </g>
      <path d="M40 40a11 11 0 0 0-21.8-2.2A9 9 0 1 0 5 47H40a9 9 0 0 0 0-18z" stroke="#93c5fd"/>
    </svg>
  )
}

// Compact inline display for job cards
export default function WeatherIcon({ location }: { location: string }) {
  const [data, setData] = useState<WeatherApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSheet, setShowSheet] = useState(false)

  useEffect(() => {
    if (!location) return
    fetch(`/api/weather?location=${encodeURIComponent(location)}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.current?.temp != null) setData(d)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [location])

  if (loading) {
    return (
      <div className="flex items-center gap-2 self-center">
        <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
        <span className="text-[28px] font-light text-white/40 leading-none">--°</span>
      </div>
    )
  }
  if (!data) return null

  const { current, daily } = data
  const hasBadWeather = /thunder|storm|tornado|hurricane|rain|drizzle|snow|sleet/i.test(current.main)
  const isSevere = /thunder|storm|tornado|hurricane/i.test(current.main)

  const formatDay = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0]
    if (dateStr === today) return 'Today'
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  }

  return (
    <>
      {/* Compact card view */}
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); setShowSheet(true) }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setShowSheet(true) } }}
        className="flex items-center gap-2 self-center relative cursor-pointer"
      >
        <WeatherSVG condition={current.main} size="sm" />
        <span className="text-[28px] font-light text-white leading-none">{Math.round(current.temp)}°</span>
        {hasBadWeather && (
          <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#2F5F7F] ${isSevere ? 'bg-red-500' : 'bg-yellow-400'}`} />
        )}
      </div>

      {/* Detail sheet */}
      {showSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowSheet(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-sm bg-gradient-to-b from-[#1c3a4a] to-[#0d1f2a] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Pull handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-4 pb-2">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-widest mb-0.5">Weather</div>
                <div className="text-lg font-semibold text-white">{data.location.name}{data.location.state ? `, ${data.location.state}` : ''}</div>
              </div>
              <button onClick={() => setShowSheet(false)} className="p-1 text-white/40 hover:text-white/80 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Current conditions */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-[56px] font-thin text-white leading-none tracking-tighter">{Math.round(current.temp)}°</div>
                <div className="text-sm text-white/60 mt-1 capitalize">{current.description}</div>
              </div>
              <WeatherSVG condition={current.main} size="lg" />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-px bg-white/5 mx-5 rounded-xl overflow-hidden mb-4">
              {[
                { label: 'Feels like', value: `${Math.round(current.feels_like)}°` },
                { label: 'Humidity', value: `${current.humidity}%` },
                { label: 'Wind', value: `${current.wind_speed} mph` },
              ].map(s => (
                <div key={s.label} className="bg-white/5 px-3 py-2.5 text-center">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">{s.label}</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{s.value}</div>
                </div>
              ))}
            </div>

            {/* 5-day forecast */}
            {daily && daily.length > 0 && (
              <div className="px-5 pb-6">
                <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2">5-Day Forecast</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {daily.map(day => (
                    <div key={day.date} className="bg-white/5 rounded-xl py-2.5 flex flex-col items-center gap-1">
                      <div className="text-[10px] text-white/50">{formatDay(day.date)}</div>
                      <WeatherSVG condition={day.main} size="xs" />
                      <div className="text-xs font-semibold text-white">{day.high}°</div>
                      <div className="text-[10px] text-white/40">{day.low}°</div>
                      {day.pop > 20 && (
                        <div className="text-[9px] text-blue-300">{day.pop}%</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
