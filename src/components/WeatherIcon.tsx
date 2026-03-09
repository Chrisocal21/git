'use client'

import { useEffect, useState } from 'react'

interface WeatherData {
  temp: number
  condition: string
}

export default function WeatherIcon({ location }: { location: string }) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchWeather() {
      try {
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime()
        const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}&t=${timestamp}`, {
          cache: 'no-store'
        })
        if (response.ok) {
          const data = await response.json()
          console.log(`[Weather] ${location}:`, data.current.temp, '°F -', data.current.main)
          setWeather({
            temp: data.current.temp,
            condition: data.current.main || data.current.description
          })
        }
      } catch (error) {
        console.error('Failed to fetch weather:', error)
      } finally {
        setLoading(false)
      }
    }

    if (location) {
      fetchWeather()
    }
  }, [location])

  if (loading || !weather) {
    return (
      <div className="flex items-center gap-2 self-center">
        <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse" />
        <span className="text-[32px] font-light text-white leading-none">--°</span>
      </div>
    )
  }

  // iOS-style weather icons based on condition
  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase()
    
    // Clear/Sunny
    if (lowerCondition.includes('clear') || lowerCondition.includes('sunny')) {
      return (
        <svg className="w-12 h-12 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="11" fill="none"/>
          <line x1="32" y1="7" x2="32" y2="15"/>
          <line x1="57" y1="32" x2="49" y2="32"/>
          <line x1="32" y1="57" x2="32" y2="49"/>
          <line x1="7" y1="32" x2="15" y2="32"/>
          <line x1="49.5" y1="14.5" x2="43.8" y2="20.2"/>
          <line x1="20.2" y1="43.8" x2="14.5" y2="49.5"/>
          <line x1="43.8" y1="43.8" x2="49.5" y2="49.5"/>
          <line x1="14.5" y1="14.5" x2="20.2" y2="20.2"/>
        </svg>
      )
    }
    
    // Cloudy
    if (lowerCondition.includes('cloud') || lowerCondition.includes('overcast')) {
      return (
        <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
          <path d="M43 30a10 10 0 0 0-19.8-2A8 8 0 1 0 9 38h34a8 8 0 0 0 0-16z"/>
          <path d="M48 38a6 6 0 0 0-5.8-6 10 10 0 0 0-19.6 0A6 6 0 1 0 17 44h31a6 6 0 0 0 0-12z" opacity="0.6"/>
        </svg>
      )
    }
    
    // Rain
    if (lowerCondition.includes('rain') || lowerCondition.includes('drizzle')) {
      return (
        <svg className="w-12 h-12 text-blue-300" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
          <path d="M43 26a10 10 0 0 0-19.8-2A8 8 0 1 0 9 34h34a8 8 0 0 0 0-16z"/>
          <line x1="17" y1="42" x2="14" y2="48"/>
          <line x1="25" y1="42" x2="22" y2="48"/>
          <line x1="33" y1="42" x2="30" y2="48"/>
          <line x1="41" y1="42" x2="38" y2="48"/>
        </svg>
      )
    }
    
    // Thunderstorm
    if (lowerCondition.includes('thunder') || lowerCondition.includes('storm')) {
      return (
        <svg className="w-12 h-12 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
          <path d="M43 26a10 10 0 0 0-19.8-2A8 8 0 1 0 9 34h34a8 8 0 0 0 0-16z"/>
          <path d="M27 38l-4 8h6l-4 8" strokeWidth="3"/>
        </svg>
      )
    }
    
    // Snow
    if (lowerCondition.includes('snow') || lowerCondition.includes('sleet')) {
      return (
        <svg className="w-12 h-12 text-cyan-200" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
          <path d="M43 26a10 10 0 0 0-19.8-2A8 8 0 1 0 9 34h34a8 8 0 0 0 0-16z"/>
          <circle cx="17" cy="44" r="1.5" fill="currentColor"/>
          <circle cx="25" cy="44" r="1.5" fill="currentColor"/>
          <circle cx="33" cy="44" r="1.5" fill="currentColor"/>
          <circle cx="41" cy="44" r="1.5" fill="currentColor"/>
          <circle cx="21" cy="49" r="1.5" fill="currentColor"/>
          <circle cx="29" cy="49" r="1.5" fill="currentColor"/>
          <circle cx="37" cy="49" r="1.5" fill="currentColor"/>
        </svg>
      )
    }
    
    // Fog/Mist
    if (lowerCondition.includes('fog') || lowerCondition.includes('mist') || lowerCondition.includes('haze')) {
      return (
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
          <path d="M43 26a10 10 0 0 0-19.8-2A8 8 0 1 0 9 34h34a8 8 0 0 0 0-16z"/>
          <line x1="10" y1="42" x2="35" y2="42"/>
          <line x1="15" y1="48" x2="40" y2="48"/>
          <line x1="10" y1="54" x2="30" y2="54"/>
        </svg>
      )
    }
    
    // Default: partly cloudy (cloud with sun)
    return (
      <svg className="w-12 h-12 text-blue-300" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 64 64">
        <circle cx="40" cy="20" r="8" opacity="0.5" className="text-yellow-400" stroke="currentColor"/>
        <line x1="40" y1="8" x2="40" y2="12" opacity="0.5" className="text-yellow-400" stroke="currentColor"/>
        <line x1="52" y1="20" x2="48" y2="20" opacity="0.5" className="text-yellow-400" stroke="currentColor"/>
        <line x1="47" y1="13" x2="44.5" y2="15.5" opacity="0.5" className="text-yellow-400" stroke="currentColor"/>
        <path d="M38 30a10 10 0 0 0-19.8-2A8 8 0 1 0 4 38h34a8 8 0 0 0 0-16z"/>
      </svg>
    )
  }

  return (
    <div className="flex items-center gap-2 self-center">
      {getWeatherIcon(weather.condition)}
      <span className="text-[32px] font-light text-white leading-none">{Math.round(weather.temp)}°</span>
    </div>
  )
}
