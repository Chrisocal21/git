'use client'

import { useState, useEffect } from 'react'
import { BurrowLogo } from './BurrowLogo'

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
    <div className="fixed inset-0 z-[100000] bg-canvas flex items-center justify-center p-6 overflow-y-auto">
      {/* Soft teal wash behind the mark */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(42,123,155,0.16) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm">
        {/* Logo/Header */}
        <div className="text-center mb-10">
          <BurrowLogo className="w-16 h-16 mx-auto mb-5" />
          <h1 className="text-3xl font-semibold text-white mb-2">burrow</h1>
          <p className="text-sm text-white/55">Enter PIN to continue</p>
        </div>

        {/* PIN Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="pin" className="label">
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
              aria-invalid={error}
              aria-describedby={error ? 'pin-error' : undefined}
              className={`w-full px-6 py-4 bg-surface border rounded-xl text-center text-2xl tracking-[0.5em] font-mono tabular transition-colors placeholder:text-white/20 focus:outline-none focus:ring-2 ${
                error
                  ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30 text-red-400'
                  : 'border-line-strong focus:border-gold focus:ring-gold/25 text-white'
              }`}
            />
            {error && (
              <p id="pin-error" role="alert" className="mt-2 text-sm text-red-400 text-center animate-shake">
                Incorrect PIN. Please try again.
              </p>
            )}
          </div>

          {/* Remember Me */}
          <label htmlFor="remember" className="flex items-center gap-2.5 text-sm text-white/65 cursor-pointer select-none">
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Remember me on this device
          </label>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={pin.length !== 6 || isVerifying}
            className="btn-primary w-full py-3.5 rounded-xl text-base"
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
        <div className="mt-10 text-center eyebrow text-white/30">
          For team members only
        </div>
      </div>
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
