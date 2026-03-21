'use client'

import { useState, useEffect } from 'react'

const PIN_STORAGE_KEY = 'burrow-pin-auth'

export default function PinScreen() {
  const [pin, setPin] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  useEffect(() => {
    // Check if user is already authenticated (localStorage for remember me, sessionStorage for current session)
    const savedAuth = localStorage.getItem(PIN_STORAGE_KEY) || sessionStorage.getItem(PIN_STORAGE_KEY)
    if (savedAuth === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setIsVerifying(true)
    setError(false)
    
    try {
      // Call API to verify PIN
      const response = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin }),
      })
      
      const data = await response.json()
      
      if (data.verified) {
        // PIN is correct
        if (rememberMe) {
          localStorage.setItem(PIN_STORAGE_KEY, 'true')
        } else {
          // Set session-only auth (will clear on browser close)
          sessionStorage.setItem(PIN_STORAGE_KEY, 'true')
        }
        setIsAuthenticated(true)
        // Dispatch custom event to notify wrapper
        window.dispatchEvent(new Event('pin-auth-changed'))
      } else {
        // PIN is incorrect
        setError(true)
        setPin('')
      }
    } catch (error) {
      console.error('PIN verification error:', error)
      setError(true)
      setPin('')
    } finally {
      setIsVerifying(false)
    }
  }

  const handlePinChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/\D/g, '')
    setPin(numericValue)
    setError(false)
  }

  // If authenticated, don't render anything (parent will show main app)
  if (isAuthenticated) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[100000] bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#2a2a2a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-block">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#3A6B86] to-[#2F5F7F] rounded-2xl flex items-center justify-center shadow-[0_8px_20px_rgba(232,180,77,0.2)]">
              <svg className="w-10 h-10 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">burrow</h1>
          <p className="text-white/60">Enter PIN to continue</p>
        </div>

        {/* PIN Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-white/80 mb-2">
              Team PIN
            </label>
            <input
              id="pin"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              placeholder="••••••"
              autoFocus
              className={`w-full px-6 py-4 bg-white/5 border-2 rounded-xl text-center text-2xl tracking-[0.5em] font-mono transition-all focus:outline-none ${
                error
                  ? 'border-red-500/50 focus:border-red-500 text-red-400'
                  : 'border-white/10 focus:border-[#E8B44D] text-white'
              }`}
            />
            {error && (
              <p className="mt-2 text-sm text-red-400 text-center animate-shake">
                Incorrect PIN. Please try again.
              </p>
            )}
          </div>

          {/* Remember Me */}
          <div className="flex items-center">
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#E8B44D] focus:ring-[#E8B44D] focus:ring-offset-0 focus:ring-2"
            />
            <label htmlFor="remember" className="ml-2 text-sm text-white/70">
              Remember me on this device
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={pin.length !== 6 || isVerifying}
            className="w-full py-4 bg-gradient-to-r from-[#E8B44D] to-[#D4A03C] hover:from-[#D4A03C] hover:to-[#C08F2B] text-black font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(232,180,77,0.3)]"
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </span>
            ) : pin.length === 6 ? (
              'Unlock'
            ) : (
              'Enter PIN'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-white/40">
          For team members only
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  )
}

// Export a hook to check PIN auth status
export function usePinAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = () => {
      const savedAuth = localStorage.getItem(PIN_STORAGE_KEY)
      setIsAuthenticated(savedAuth === 'true')
    }
    
    checkAuth()
    
    // Listen for storage changes (for multi-tab support)
    window.addEventListener('storage', checkAuth)
    return () => window.removeEventListener('storage', checkAuth)
  }, [])

  const logout = () => {
    localStorage.removeItem(PIN_STORAGE_KEY)
    setIsAuthenticated(false)
    window.location.reload()
  }

  return { isAuthenticated, logout }
}
