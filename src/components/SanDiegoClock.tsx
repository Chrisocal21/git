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


interface WeatherData {
  location: {
    name: string
    state: string | null
    country: string
  }
  current: {
    temp: number
    feels_like: number
    description: string
    main: string
    icon: string
    humidity: number
    wind_speed: number
  }
  daily: Array<{
    date: string
    temp: number
    low: number
    high: number
    description: string
    main: string
    icon: string
    pop: number
    humidity: number
    wind_speed: number
  }>
}

export default function SanDiegoClock() {
  const [time, setTime] = useState<string>('')
  const [isOpen, setIsOpen] = useState(false)
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  useEffect(() => {
    const updateTime = () => {
      // Get current time in San Diego (America/Los_Angeles timezone)
      const sdTime = new Date().toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      setTime(sdTime)
    }

    updateTime()
    const interval = setInterval(updateTime, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Fetch San Diego weather when modal opens
  useEffect(() => {
    if (!isOpen || weatherData) return

    const fetchWeather = async () => {
      setWeatherLoading(true)
      try {
        // Try different location formats
        const locations = ['San Diego, CA, US', 'San Diego, California', 'San Diego']
        let success = false
        
        for (const location of locations) {
          try {
            const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`)
            
            if (response.ok) {
              const data = await response.json()
              setWeatherData(data)
              success = true
              break
            } else {
              const errorData = await response.json()
              console.warn(`Weather fetch failed for "${location}":`, errorData)
            }
          } catch (err) {
            console.warn(`Weather fetch error for "${location}":`, err)
          }
        }
        
        if (!success) {
          console.error('All weather fetch attempts failed')
        }
      } catch (error) {
        console.error('Failed to fetch SD weather:', error)
      } finally {
        setWeatherLoading(false)
      }
    }

    fetchWeather()
  }, [isOpen, weatherData])

  if (!time) return null

  return (
    <>
      {/* Inline button for fldr page header */}
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

      {/* Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center p-4 pt-16"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
              <h3 className="text-lg font-semibold">Home Base</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* San Diego Time */}
              <div className="p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="text-sm text-gray-400">San Diego, CA</span>
                </div>
                <div className="text-3xl font-bold text-white tabular-nums">{time}</div>
                <div className="text-xs text-gray-500 mt-1">Pacific Time</div>
              </div>

              {/* San Diego Weather */}
              <div className="p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
                {weatherLoading && (
                  <div className="flex items-center justify-center py-4">
                    <div className="text-gray-400 text-sm">Loading weather...</div>
                  </div>
                )}
                
                {!weatherLoading && weatherData?.current && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img 
                          src={`https://openweathermap.org/img/wn/${weatherData.current.icon}@2x.png`}
                          alt={weatherData.current.description}
                          className="w-12 h-12"
                        />
                        <div>
                          <div className="text-2xl font-bold text-white">{weatherData.current.temp}°F</div>
                          <div className="text-xs text-gray-400 capitalize">{weatherData.current.description}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-xs text-gray-400">Feels Like</div>
                        <div className="text-sm font-semibold">{weatherData.current.feels_like}°F</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-400">Humidity</div>
                        <div className="text-sm font-semibold">{weatherData.current.humidity}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-400">Wind</div>
                        <div className="text-sm font-semibold">{weatherData.current.wind_speed} mph</div>
                      </div>
                    </div>
                    
                    {/* 5-Day Forecast */}
                    {weatherData.daily && weatherData.daily.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-[#2a2a2a]">
                        <div className="text-xs text-gray-400 mb-2">5-Day Forecast</div>
                        <div className="grid grid-cols-5 gap-2">
                          {weatherData.daily.map((day: any, index: number) => {
                            // Get today's date in YYYY-MM-DD format for proper comparison
                            const today = new Date()
                            const todayStr = today.getFullYear() + '-' + 
                              String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                              String(today.getDate()).padStart(2, '0')
                            
                            const date = new Date(day.date + 'T12:00:00')
                            const isToday = day.date === todayStr
                            const dayName = isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })
                            
                            return (
                              <div 
                                key={day.date} 
                                className="p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-center"
                              >
                                <div className="text-xs text-gray-400 mb-1">{dayName}</div>
                                <img 
                                  src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                                  alt={day.description}
                                  className="w-10 h-10 mx-auto"
                                />
                                <div className="text-sm font-semibold">{day.high}°</div>
                                <div className="text-xs text-gray-500">{day.low}°</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!weatherLoading && (!weatherData || !weatherData.current) && (
                  <div className="text-xs text-gray-400 text-center py-4">
                    Weather unavailable
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="text-xs text-gray-400 text-center">
                <p>Your home time & weather</p>
                <p className="mt-1">Job-specific weather is shown on each fldr page</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
