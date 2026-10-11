import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, createSessionToken, pinPolicy, sessionCookieOptions, verifySessionToken } from '@/lib/pinSession'

export const dynamic = 'force-dynamic'

// Wrong guesses per address, so a script can't simply try every PIN.
// It lives in this server's memory, so it is a speed bump rather than a wall: a fresh
// server starts counting from zero. It still turns a few minutes of guessing into days.
const MAX_WRONG = 10
const WINDOW_MS = 10 * 60 * 1000
const wrongGuesses = new Map<string, { count: number; since: number }>()

function caller(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function lockedOut(who: string, now: number): boolean {
  const entry = wrongGuesses.get(who)
  if (!entry) return false
  if (now - entry.since > WINDOW_MS) {
    wrongGuesses.delete(who)
    return false
  }
  return entry.count >= MAX_WRONG
}

function noteWrongGuess(who: string, now: number) {
  const entry = wrongGuesses.get(who)
  if (!entry || now - entry.since > WINDOW_MS) wrongGuesses.set(who, { count: 1, since: now })
  else entry.count++
  // Keep the list from growing without end
  if (wrongGuesses.size > 5000) {
    wrongGuesses.forEach((value, key) => {
      if (now - value.since > WINDOW_MS) wrongGuesses.delete(key)
    })
  }
}

/** Sign in: the right PIN sets the cookie the data routes look for */
export async function POST(request: NextRequest) {
  try {
    const { pin, remember } = await request.json()

    // Get PIN from environment variable
    const correctPin = process.env.APP_PIN

    if (!correctPin) {
      console.error('[PIN] APP_PIN environment variable not set')
      return NextResponse.json(
        { verified: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const now = Date.now()
    const who = caller(request)
    if (lockedOut(who, now)) {
      return NextResponse.json({ verified: false, error: 'Too many tries. Wait ten minutes and try again.', locked: true }, { status: 429 })
    }

    // Verify PIN
    const isValid = typeof pin === 'string' && pin === correctPin

    if (!isValid) {
      console.log('[PIN] Invalid PIN attempt')
      noteWrongGuess(who, now)
      return NextResponse.json({ verified: false })
    }

    console.log('[PIN] Valid PIN entered')
    wrongGuesses.delete(who)
    // "Remember me" has always been on unless someone switches it off
    const keep = remember !== false
    const response = NextResponse.json({ verified: true })
    response.cookies.set(SESSION_COOKIE, await createSessionToken(correctPin, keep, now), sessionCookieOptions(keep))
    return response
  } catch (error) {
    console.error('[PIN] Verification error:', error)
    return NextResponse.json(
      { verified: false, error: 'Verification failed' },
      { status: 500 }
    )
  }
}

/** "Am I signed in?" The app asks this when it opens, so the server decides, not the phone. */
async function status(request: NextRequest) {
  const { pin, open } = pinPolicy()
  // A local copy with no PIN set up has nothing to sign in to
  if (open) return NextResponse.json({ signedIn: true, pinRequired: false })
  if (!pin) return NextResponse.json({ signedIn: false, pinRequired: true })

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, pin)
  const response = NextResponse.json({ signedIn: session.valid, pinRequired: true })
  // A remembered phone gets a fresh year each time the app is opened, so it is never asked again while in use
  if (session.valid && session.remember) {
    response.cookies.set(SESSION_COOKIE, await createSessionToken(pin, true), sessionCookieOptions(true))
  }
  return response
}

export const GET = status
// The app asks with PUT: the service worker keeps copies of GET answers, and an old copy
// of this one could tell a signed-in phone it was signed out
export const PUT = status

/** Sign out: the cookie goes */
export async function DELETE() {
  const response = NextResponse.json({ signedIn: false })
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(false), maxAge: 0 })
  return response
}
