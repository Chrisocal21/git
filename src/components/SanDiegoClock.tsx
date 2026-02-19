'use client'

import { useState, useEffect } from 'react'

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
        const response = await fetch('/api/weather?location=San Diego, CA')
        if (response.ok) {
          const data = await response.json()
          setWeatherData(data)
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
