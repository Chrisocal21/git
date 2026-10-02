import { Fldr, FlightSegment } from '@/types/fldr'

const dayKey = (s: string | null | undefined) => (s ? s.split('T')[0] : null)

const sharedPeople = (a: Fldr, b: Fldr) => {
  return (a.people || []).some(pa => (b.people || []).some(pb => sameName(pa.name, pb.name)))
}

/**
 * A flight is "onward" when it lands after this job ends, on a day that falls
 * inside another job the same people are working (e.g. a return flight that is
 * really the outbound flight to the next job). Its arrival belongs to that
 * other job, so this job should only count the departure.
 */
export function isOnwardFlight(seg: FlightSegment, fldr: Fldr, all: Fldr[]): boolean {
  const arr = dayKey(seg.arrival_time)
  const end = dayKey(fldr.date_end || fldr.date_start)
  if (!arr || !end || arr <= end) return false

  return all.some(other => {
    if (other.id === fldr.id || other.archived || other.fldr_type === 'time_off') return false
    if (!sharedPeople(fldr, other)) return false
    const oStart = dayKey(other.date_start)!
    const oEnd = dayKey(other.date_end || other.date_start)!
    // Allow the flight to land the day before the next job starts
    const dayBefore = new Date(oStart + 'T00:00:00')
    dayBefore.setDate(dayBefore.getDate() - 1)
    const earliest = dayKey(
      `${dayBefore.getFullYear()}-${String(dayBefore.getMonth() + 1).padStart(2, '0')}-${String(dayBefore.getDate()).padStart(2, '0')}`
    )!
    return arr >= earliest && arr <= oEnd
  })
}

/** "Taylor" matches "Taylor Elson" (and vice versa); compares on first name. */
const sameName = (a: string, b: string) => {
  const first = (s: string) => s.trim().toLowerCase().split(/\s+/)[0]
  return first(a) === first(b)
}

/**
 * Returns arrival-trimmed copies: onward flights keep departure only.
 * With `person`, only segments that person is on are returned (segments with
 * no travelers listed apply to everyone).
 */
export function getOwnFlights(fldr: Fldr, all: Fldr[], person?: string): FlightSegment[] {
  if (!Array.isArray(fldr.flight_info)) return []
  const segs = person
    ? fldr.flight_info.filter(
        s => !s.travelers || s.travelers.length === 0 ||
          s.travelers.some(t => sameName(t, person))
      )
    : fldr.flight_info
  return segs.map(seg =>
    isOnwardFlight(seg, fldr, all) ? { ...seg, arrival_time: null } : seg
  )
}
