// Reading and showing what a job stores.
// Dates are YYYY-MM-DD and times are what a datetime-local input gives ("2026-03-14T08:05").
// Both are wall-clock values with no timezone, so they're read as local: a flight that
// leaves at 8:05 shows 8:05 wherever the phone is, and a date never slips a day.

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/

export function parseLocal(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = WALL_CLOCK.exec(value)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), m[4] ? Number(m[4]) : 0, m[5] ? Number(m[5]) : 0)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function hasClock(value: string): boolean {
  return /[T ]\d{2}:\d{2}/.test(value)
}

/** The calendar day a stored date or time falls on, as YYYY-MM-DD */
export function dayKey(value: string | null | undefined): string | null {
  const d = parseLocal(value)
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Mar 14", or "Mar 14, 2025" for another year. With weekday: "Sat, Mar 14". */
export function fmtDay(value: string | null | undefined, weekday = false): string {
  const d = parseLocal(value)
  if (!d) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-US', {
    ...(weekday ? { weekday: 'short' as const } : {}),
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' as const }),
  })
}

/** "8:05 AM". Empty when the value carries no time of day. */
export function fmtTime(value: string | null | undefined): string {
  if (!value || !hasClock(value)) return ''
  const d = parseLocal(value)
  return d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
}

/** "Sat, Mar 14 · 8:05 AM" */
export function fmtDateTime(value: string | null | undefined): string {
  return [fmtDay(value, true), fmtTime(value)].filter(Boolean).join(' · ')
}

/** "Mar 14", "Mar 14 – 16" or "Mar 30 – Apr 2" */
export function fmtDayRange(start: string | null | undefined, end: string | null | undefined): string {
  const from = parseLocal(start)
  const to = parseLocal(end)
  if (!from && !to) return ''
  if (!from || !to) return fmtDay(start || end)
  if (dayKey(start) === dayKey(end)) return fmtDay(start)
  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()
  const sameYear = to.getFullYear() === new Date().getFullYear()
  if (sameMonth) {
    const month = from.toLocaleDateString('en-US', { month: 'short' })
    return `${month} ${from.getDate()} – ${to.getDate()}${sameYear ? '' : `, ${to.getFullYear()}`}`
  }
  return `${fmtDay(start)} – ${fmtDay(end)}`
}

/** A daily schedule time ("09:00") as "9:00 AM" */
export function fmtClock(hhmm: string | null | undefined): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** "9:00 AM – 5:00 PM", carrying the day onto the end when it finishes on another one */
export function fmtTimeSpan(start: string | null | undefined, end: string | null | undefined): string {
  const from = fmtTime(start)
  const to = fmtTime(end)
  if (from && to) {
    const otherDay = dayKey(start) !== dayKey(end)
    return `${from} – ${otherDay ? `${fmtDay(end)} ` : ''}${to}`
  }
  return from || (to ? `Until ${to}` : '')
}

export function jobTypeLabel(type: string | null | undefined): string | null {
  if (type === 'caricatures') return 'Caricatures'
  // names_monograms is what personalization was called on older jobs
  if (type === 'personalization' || type === 'names_monograms') return 'Personalization'
  return null
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

/** A pasted link as something a browser will open ("asana.com/..." gets its https://) */
export function linkHref(url: string): string {
  const trimmed = url.trim()
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** The site a link points at, for showing a link that has no label */
export function linkHost(url: string): string {
  try {
    return new URL(linkHref(url)).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Notes can hold rich text; this is the readable first stretch of them */
export function plainText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    // The end of a paragraph or line is a break between words; other tags sit inside the text
    .replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
