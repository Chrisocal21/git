'use client'

import { useState, useEffect } from 'react'
import { WeatherSVG } from './WeatherIcon'

interface WeatherData {
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
    high: number
    low: number
    description: string
    main: string
    pop: number
  }>
}

function formatDay(dateStr: string) {
  const today = new Date().toISOString().split('T')[0]
  if (dateStr === today) return 'Today'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

export default function SanDiegoClock() {
  const [time, setTime] = useState<string>('')
  const [isOpen, setIsOpen] = useState(false)
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }))
    }
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isOpen || weatherData) return
    setWeatherLoading(true)
    fetch('/api/weather?location=San%20Diego%2C%20CA')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.current) setWeatherData(d) })
      .catch(() => {})
      .finally(() => setWeatherLoading(false))
  }, [isOpen, weatherData])

  if (!time) return null

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-white tabular-nums">SD {time}</span>
        </div>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-gradient-to-b from-[#1c3a4a] to-[#0d1f2a] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Pull handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div>
                <div className="text-xs text-white/40 uppercase tracking-widest mb-0.5">Homebase</div>
                <div className="text-lg font-semibold text-white">San Diego, CA</div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 text-white/40 hover:text-white/80 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Time */}
            <div className="px-5 py-3 border-b border-white/10">
              <div className="text-[48px] font-thin text-white tabular-nums leading-none">{time}</div>
              <div className="text-xs text-white/40 mt-1">Pacific Time</div>
            </div>

            {/* Weather */}
            <div className="px-5 py-4">
              {weatherLoading && (
                <div className="text-sm text-white/40 text-center py-6">Loading weather…</div>
              )}

              {!weatherLoading && weatherData?.current && (
                <>
                  {/* Current */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-[52px] font-thin text-white leading-none">{weatherData.current.temp}°</div>
                      <div className="text-sm text-white/60 capitalize mt-1">{weatherData.current.description}</div>
                    </div>
                    <WeatherSVG condition={weatherData.current.main} size="lg" />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-px bg-white/5 rounded-xl overflow-hidden mb-4">
                    {[
                      { label: 'Feels like', value: `${weatherData.current.feels_like}°` },
                      { label: 'Humidity', value: `${weatherData.current.humidity}%` },
                      { label: 'Wind', value: `${weatherData.current.wind_speed} mph` },
                    ].map(s => (
                      <div key={s.label} className="bg-white/5 px-3 py-2.5 text-center">
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">{s.label}</div>
                        <div className="text-sm font-semibold text-white mt-0.5">{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* 5-day forecast */}
                  {weatherData.daily.length > 0 && (
                    <>
                      <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2">5-Day Forecast</div>
                      <div className="grid grid-cols-5 gap-1.5 pb-2">
                        {weatherData.daily.map(day => (
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
                    </>
                  )}
                </>
              )}

              {!weatherLoading && !weatherData?.current && (
                <div className="text-sm text-white/30 text-center py-6">Weather unavailable</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
