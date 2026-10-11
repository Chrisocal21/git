// Proof that the team PIN was entered, so the server can check it on every data request.
//
// Before this, the PIN only hid the screens: the data routes answered anyone who had the
// site address. Now a correct PIN sets a cookie holding a signed pass, and the middleware
// turns away any data request that doesn't carry a valid one.
//
// The pass is signed with a key made from the PIN itself, so there is no second secret to
// set up, and changing the PIN signs every phone out at once.
//
// This file runs in two places (the middleware's edge runtime and the Node routes), so it
// sticks to the Web Crypto that both have.

export const SESSION_COOKIE = 'burrow_session'

/** "Remember me" keeps a phone signed in for a year, and the year restarts each time the app is opened */
export const REMEMBER_SECONDS = 365 * 24 * 60 * 60
/** Without it, the pass lasts a day, and the cookie goes when the browser is closed */
const SESSION_SECONDS = 24 * 60 * 60

const encoder = new TextEncoder()

function base64url(bytes: ArrayBuffer): string {
  let binary = ''
  for (const byte of Array.from(new Uint8Array(bytes))) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sign(pin: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(`burrow-session-v1:${pin}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
}

/** Compares in the same time whether or not the two match, so the answer can't be timed */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** A fresh pass for someone who just entered the right PIN */
export async function createSessionToken(pin: string, remember: boolean, now: number = Date.now()): Promise<string> {
  const expires = now + (remember ? REMEMBER_SECONDS : SESSION_SECONDS) * 1000
  const body = `v1.${expires}.${remember ? 1 : 0}`
  return `${body}.${await sign(pin, body)}`
}

export interface SessionCheck {
  valid: boolean
  /** Whether the pass was made with "Remember me" on */
  remember: boolean
}

/** Whether a pass is real, was made with the current PIN, and hasn't run out */
export async function verifySessionToken(token: string | undefined | null, pin: string, now: number = Date.now()): Promise<SessionCheck> {
  const invalid: SessionCheck = { valid: false, remember: false }
  if (!token) return invalid
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') return invalid
  const [version, expiresText, rememberFlag, signature] = parts
  const expires = Number(expiresText)
  if (!Number.isFinite(expires) || expires <= now) return invalid
  if (rememberFlag !== '0' && rememberFlag !== '1') return invalid
  const expected = await sign(pin, `${version}.${expiresText}.${rememberFlag}`)
  if (!sameText(signature, expected)) return invalid
  return { valid: true, remember: rememberFlag === '1' }
}

/** How the cookie is set. Scripts on the page can't read it, and it's only sent to Burrow itself. */
export function sessionCookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // No maxAge makes it a cookie that goes when the browser is closed
    ...(remember ? { maxAge: REMEMBER_SECONDS } : {}),
  }
}

/**
 * The PIN the server checks against. With none set, a local copy on someone's computer
 * stays open (there is nothing to check), but the live site answers nobody: a missing PIN
 * there is a mistake, and it should be loud rather than leave the data unguarded.
 */
export function pinPolicy(): { pin: string | null; open: boolean } {
  const pin = process.env.APP_PIN || null
  return { pin, open: !pin && process.env.NODE_ENV !== 'production' }
}
