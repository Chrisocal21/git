'use client'

import { useState, useEffect } from 'react'
import PinScreen from './PinScreen'

const PIN_STORAGE_KEY = 'burrow-pin-auth'

export default function PinAuthWrapper({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // This only runs on client, avoiding hydration mismatch
    const checkAuth = () => {
      const savedAuth = localStorage.getItem(PIN_STORAGE_KEY) || sessionStorage.getItem(PIN_STORAGE_KEY)
      setIsAuthenticated(savedAuth === 'true')
      setIsLoading(false)
    }
    
    checkAuth()
    
    // Listen for auth changes (when PIN screen sets auth)
    const handleStorageChange = () => {
      const savedAuth = localStorage.getItem(PIN_STORAGE_KEY) || sessionStorage.getItem(PIN_STORAGE_KEY)
      if (savedAuth === 'true') {
        setIsAuthenticated(true)
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // Custom event for same-tab auth changes
    const handleAuthChange = () => {
      const savedAuth = localStorage.getItem(PIN_STORAGE_KEY) || sessionStorage.getItem(PIN_STORAGE_KEY)
      setIsAuthenticated(savedAuth === 'true')
    }
    
    window.addEventListener('pin-auth-changed', handleAuthChange)
    
    // Poll for auth changes (fallback for same-tab)
    const pollInterval = setInterval(() => {
      const savedAuth = localStorage.getItem(PIN_STORAGE_KEY) || sessionStorage.getItem(PIN_STORAGE_KEY)
      if (savedAuth === 'true' && !isAuthenticated) {
        setIsAuthenticated(true)
      }
    }, 500)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('pin-auth-changed', handleAuthChange)
      clearInterval(pollInterval)
    }
  }, [isAuthenticated])

  // Show nothing while checking auth (prevents flash and hydration mismatch)
  if (isLoading || isAuthenticated === null) {
    return (
      <div className="min-h-[100dvh] bg-canvas flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin"></div>
      </div>
    )
  }

  // Show PIN screen if not authenticated
  if (!isAuthenticated) {
    return <PinScreen />
  }

  // Show main app if authenticated
  return <>{children}</>
}
