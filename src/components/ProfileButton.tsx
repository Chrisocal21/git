/**
 * ProfileButton Component
 * Shows user profile menu with role badge
 * Prepared for authentication - currently shows "Dev Mode"
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { getCurrentUser } from '@/lib/auth'

export default function ProfileButton() {
  const user = getCurrentUser()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
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
  
  if (!user) return null
  
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  return (
    <div className="relative" ref={menuRef}>
      {/* Profile button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        title="Profile"
      >
        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-700">
            <div className="text-sm font-medium text-white">{user.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">{user.email}</div>
          </div>
          
          <div className="p-2">
            <div className="flex items-center gap-2 px-2 py-1.5">
              {isDevelopment && (
                <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">
                  Dev Mode
                </span>
              )}
              <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                {user.role === 'admin' ? 'Admin' : 'Viewer'}
              </span>
            </div>
          </div>
          
          <div className="p-2 border-t border-gray-700">
            <div className="text-xs text-gray-500 px-2 py-1">
              Auth not configured yet
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
