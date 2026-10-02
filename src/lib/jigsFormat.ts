import type { JigBooking, JigHolder } from '@/types/jigs'

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayKey(): string {
  return dayKeyOf(new Date())
}

/** The local calendar day an ISO time falls on, as YYYY-MM-DD */
export function localDayKey(iso: string): string {
  return dayKeyOf(new Date(iso))
}

/** "Today", "Yesterday", "Mon, Oct 5", or "Jun 15, 2025" for another year */
export function dayHeading(key: string): string {
  if (key === todayKey()) return 'Today'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === dayKeyOf(yesterday)) return 'Yesterday'
  const [y, m, d] = key.split('-').map(Number)
  const sameYear = y === new Date().getFullYear()
  return new Date(y, m - 1, d).toLocaleDateString(
    'en-US',
    sameYear ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
  )
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Job dates are plain YYYY-MM-DD (or an ISO datetime); read the date part as local so it doesn't slip a day
export function shortDay(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function dateRange(start: string, end: string | null | undefined): string {
  const from = shortDay(start)
  const to = end ? shortDay(end) : null
  return to && to !== from ? `${from} – ${to}` : from
}

// Out, and the job it went to is already over
export function awaitingReturn(holder: { job_end: string | null }): boolean {
  return !!holder.job_end && holder.job_end.slice(0, 10) < todayKey()
}

/** "Last on Proven Promotions, back Oct 2 · checked in by Chris" */
export function lastReturnedLine(last: { job_title: string | null; at: string; by?: string | null }): string {
  const parts = [`Last on ${last.job_title ?? 'a job that was deleted'}, back ${shortDate(last.at)}`]
  if (last.by) parts.push(`checked in by ${last.by}`)
  return parts.join(' · ')
}

/** "Proven Promotions · Michael · since Oct 5 · job ends Oct 8" */
export function holderLine(holder: JigHolder): string {
  const parts = [
    holder.job_title ?? 'A job that was deleted',
    holder.checked_out_by ?? 'Someone',
    holder.checked_out_at ? `since ${shortDate(holder.checked_out_at)}` : null,
  ]
  if (holder.job_end) parts.push(`job ${awaitingReturn(holder) ? 'ended' : 'ends'} ${shortDay(holder.job_end)}`)
  return parts.filter(Boolean).join(' · ')
}

/** Where a jig is for someone else: out with a person, or planned for a job on overlapping dates */
export function bookingLine(booking: JigBooking): string {
  const title = booking.job_title ?? 'A job that was deleted'
  const unit = booking.unit_label ? `${booking.unit_label} · ` : ''
  if (booking.status === 'out') {
    const parts = [
      title,
      `${unit}${booking.qty > 1 ? `${booking.qty} out` : 'out'}`,
      booking.by ?? 'Someone',
      booking.since ? `since ${shortDate(booking.since)}` : null,
    ]
    if (booking.job_end) parts.push(`job ${awaitingReturn({ job_end: booking.job_end }) ? 'ended' : 'ends'} ${shortDay(booking.job_end)}`)
    return parts.filter(Boolean).join(' · ')
  }
  const dates = booking.job_start ? dateRange(booking.job_start, booking.job_end) : null
  return [title, `needs ${booking.qty}`, dates].filter(Boolean).join(' · ')
}
