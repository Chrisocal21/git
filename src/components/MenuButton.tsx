'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, TEAM_PROFILES, setCurrentProfile, clearProfile } from '@/lib/auth'

export default function MenuButton() {
  const router = useRouter()
  const user = getCurrentUser()
  const [isOpen, setIsOpen] = useState(false)
  const [time, setTime] = useState<string>('')
  const [homeWeather, setHomeWeather] = useState<{ temp: number; condition: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Update San Diego time
  useEffect(() => {
    const updateTime = () => {
      const sdTime = new Date().toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      setTime(sdTime)
    }

    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  // Fetch homebase weather once on open
  useEffect(() => {
    if (!isOpen || homeWeather) return
    fetch('/api/weather?location=San%20Diego%2C%20CA')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.current && typeof data.current.temp === 'number') {
          setHomeWeather({ temp: Math.round(data.current.temp), condition: data.current.main || data.current.description })
        }
      })
      .catch(() => {})
  }, [isOpen])
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])
  
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  return (
    <div className="relative" ref={menuRef}>
      {/* Menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-[#2F5F7F] hover:bg-[#3A6B86] rounded-lg transition-colors"
        title="Menu"
      >
        <svg className="w-5 h-5 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gradient-to-br from-[#3A6B86] to-[#2F5F7F] backdrop-blur-xl border border-[#E8B44D]/20 rounded-xl shadow-xl z-50">
          {/* Homebase Time */}
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-white/70">Homebase</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-[#E8B44D]">{time}</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/50 mt-1">San Diego, CA</div>
              {homeWeather && (
                <div className="text-xs text-white/50 mt-1">{homeWeather.temp}° {homeWeather.condition}</div>
              )}
            </div>
          </div>
          
          {/* Profile selector — always visible */}
          <div className="p-3 border-b border-white/10">
            <div className="text-xs text-white/50 mb-2">Profile</div>
            <div className="space-y-1">
              {/* All / Guest option */}
              <button
                onClick={() => { clearProfile(); setIsOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                  !user
                    ? 'bg-[#E8B44D]/20 border border-[#E8B44D]/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  !user ? 'bg-[#E8B44D] text-black' : 'bg-white/10 text-white/70'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-medium ${!user ? 'text-[#E8B44D]' : 'text-white'}`}>All</div>
                </div>
                {!user && (
                  <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Team profiles */}
              {TEAM_PROFILES.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => {
                    if (user?.id === profile.id) {
                      clearProfile()
                    } else {
                      setCurrentProfile(profile.id)
                    }
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    user?.id === profile.id
                      ? 'bg-[#E8B44D]/20 border border-[#E8B44D]/30'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    user?.id === profile.id ? 'bg-[#E8B44D] text-black' : 'bg-white/10 text-white/70'
                  }`}>
                    {profile.name.charAt(0)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className={`text-sm font-medium ${
                      user?.id === profile.id ? 'text-[#E8B44D]' : 'text-white'
                    }`}>
                      {profile.name}
                    </div>
                  </div>
                  {user?.id === profile.id && (
                    <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="p-2">
            <button
              onClick={() => {
                router.push('/map')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              My Flight Map
            </button>
            
            <button
              onClick={() => {
                router.push('/about')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              About
            </button>
            
            <button
              onClick={() => {
                router.push('/how-to')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How to Use
            </button>
          </div>
          
          {/* Sign Out */}
          <div className="p-2 border-t border-white/10">
            <button
              onClick={() => {
                // Clear PIN auth
                localStorage.removeItem('burrow-pin-auth')
                sessionStorage.removeItem('burrow-pin-auth')
                window.location.reload()
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
          
          {/* Footer */}
          <div className="p-3 border-t border-white/10">
            <div className="text-xs text-white/50 text-center">
              Burrow · Companion for Swanky
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
