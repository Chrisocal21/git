import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, pinPolicy, verifySessionToken } from '@/lib/pinSession'

// Every data request passes through here first. One without proof that the team PIN was
// entered gets a "sign in" answer instead of data. The screens themselves hold no data
// (they load it through these routes), so they are left alone.
export const config = { matcher: '/api/:path*' }

export async function middleware(request: NextRequest) {
  // Signing in, checking and signing out have to work for someone who isn't signed in
  if (request.nextUrl.pathname === '/api/verify-pin') return NextResponse.next()

  const { pin, open } = pinPolicy()
  if (open) return NextResponse.next()
  if (pin) {
    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, pin)
    if (session.valid) return NextResponse.next()
  }

  return NextResponse.json({ error: 'Sign in with the team PIN first.', signedOut: true }, { status: 401 })
}
