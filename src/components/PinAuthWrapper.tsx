'use client'

import { useState, useEffect, useRef } from 'react'
import PinScreen from './PinScreen'

const PIN_STORAGE_KEY = 'burrow-pin-auth'
// What the flag holds once the server has set its sign-in cookie. Older phones hold 'true',
// from when the PIN was only checked on the phone; those are asked for the PIN once more.
const SIGNED_IN = 'cookie'
// Left behind when someone signs out with no signal, so the server's cookie is cleared next time
const SIGN_OUT_PENDING = 'burrow-sign-out-pending'

function readFlag(): string | null {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) || sessionStorage.getItem(PIN_STORAGE_KEY)
  } catch {
    return null
  }
}

function clearFlag() {
  try {
    localStorage.removeItem(PIN_STORAGE_KEY)
    sessionStorage.removeItem(PIN_STORAGE_KEY)
  } catch {}
}

/**
 * Asks the server whether this phone is signed in. The server's cookie is what counts.
 * "unknown" means no answer came back (no signal, most likely).
 * It's a PUT so the service worker, which only keeps GETs, never answers it from an old copy.
 */
async function askServer(): Promise<'in' | 'out' | 'unknown'> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'unknown'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const res = await fetch('/api/verify-pin', { method: 'PUT', cache: 'no-store', signal: controller.signal })
    if (!res.ok) return 'unknown'
    const data = await res.json()
    if (data?.signedIn === true) return 'in'
    if (data?.signedIn === false) return 'out'
    return 'unknown'
  } catch {
    return 'unknown'
  } finally {
    clearTimeout(timer)
  }
}

export default function PinAuthWrapper({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const lastAsked = useRef(0)

  useEffect(() => {
    let cancelled = false

    // The flag in storage only remembers the server's last answer, so the app can still
    // open on what the phone has saved when there's no signal.
    const settle = async () => {
      // Signed out with no signal last time: finish that before anything else
      let signOutPending = false
      try {
        signOutPending = !!localStorage.getItem(SIGN_OUT_PENDING)
      } catch {}
      if (signOutPending) {
        try {
          const res = await fetch('/api/verify-pin', { method: 'DELETE' })
          if (res.ok) localStorage.removeItem(SIGN_OUT_PENDING)
        } catch {}
        if (cancelled) return
        clearFlag()
        setIsAuthenticated(false)
        return
      }

      const flag = readFlag()
      // A phone the server has already vouched for opens straight away; the check runs behind it
      if (flag === SIGNED_IN) setIsAuthenticated(true)

      lastAsked.current = Date.now()
      const answer = await askServer()
      if (cancelled) return

      if (answer === 'in') {
        // Signed in on the server but the phone forgot (storage was cleared): put the reminder back
        if (readFlag() !== SIGNED_IN) {
          try {
            localStorage.setItem(PIN_STORAGE_KEY, SIGNED_IN)
          } catch {}
        }
        setIsAuthenticated(true)
      } else if (answer === 'out') {
        clearFlag()
        setIsAuthenticated(false)
      } else {
        // No answer. Whoever was in stays in with what the phone has saved; the server
        // still turns away any request that isn't signed in.
        setIsAuthenticated(!!flag)
      }
    }
    settle()

    // The PIN screen says when someone has just signed in
    const handleAuthChange = () => {
      setIsAuthenticated(!!readFlag())
    }
    // Another tab signed in or out
    const handleStorageChange = () => {
      setIsAuthenticated(!!readFlag())
    }

    // Back online, or back to the app after a while: make sure the server still agrees
    const recheck = async () => {
      if (!readFlag()) return
      if (Date.now() - lastAsked.current < 5 * 60 * 1000) return
      lastAsked.current = Date.now()
      const answer = await askServer()
      if (cancelled || answer !== 'out') return
      clearFlag()
      setIsAuthenticated(false)
    }
    const handleOnline = () => {
      lastAsked.current = 0
      recheck()
    }
    const handleVisible = () => {
      if (document.visibilityState === 'visible') recheck()
    }

    window.addEventListener('pin-auth-changed', handleAuthChange)
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisible)

    return () => {
      cancelled = true
      window.removeEventListener('pin-auth-changed', handleAuthChange)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [])

  // Show nothing while checking auth (prevents flash and hydration mismatch)
  if (isAuthenticated === null) {
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
