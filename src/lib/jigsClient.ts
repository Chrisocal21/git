/**
 * Browser-side helpers for the jig API.
 * Writes always need a connection: two people must not grab the last jig offline.
 */
import type { JigUnavailableDetails } from '@/types/jigs'

/** A refusal from the server, with the reason code and any "where is it" details */
export class JigApiError extends Error {
  code: string | null
  details: JigUnavailableDetails | null
  constructor(message: string, code: string | null = null, details: JigUnavailableDetails | null = null) {
    super(message)
    this.code = code
    this.details = details
  }
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new JigApiError("Couldn't reach the server. Check your connection and try again.", 'offline')
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new JigApiError(
      (data && typeof data.error === 'string' && data.error) || 'Something went wrong. Try again.',
      data && typeof data.code === 'string' ? data.code : null,
      data && data.details ? data.details : null
    )
  }
  return data as T
}

export function jigsGet<T>(url: string): Promise<T> {
  return send<T>(url, { cache: 'no-store' })
}

export function jigsRequest<T>(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<T> {
  return send<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
