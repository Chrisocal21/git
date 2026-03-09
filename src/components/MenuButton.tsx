'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default function MenuButton() {
  const router = useRouter()
  const user = getCurrentUser()
  const [isOpen, setIsOpen] = useState(false)
  const [time, setTime] = useState<string>('')
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
              <div className="text-sm font-semibold text-[#E8B44D]">{time}</div>
            </div>
            <div className="text-xs text-white/50 mt-1">San Diego, CA</div>
          </div>
          
          {/* User Info */}
          {user && (
            <div className="p-3 border-b border-white/10">
              <div className="text-sm font-medium text-white">{user.name}</div>
              <div className="text-xs text-white/70 mt-0.5">{user.email}</div>
              <div className="flex items-center gap-2 mt-2">
                {isDevelopment && (
                  <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">
                    Dev Mode
                  </span>
                )}
                <span className="px-2 py-0.5 text-xs bg-[#E8B44D]/20 text-[#E8B44D] border border-[#E8B44D]/30 rounded">
                  {user.role === 'admin' ? 'Admin' : 'Viewer'}
                </span>
              </div>
            </div>
          )}
          
          {/* Menu Items */}
          <div className="p-2">
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
