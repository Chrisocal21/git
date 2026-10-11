import type { Fldr } from '@/types/fldr'
import { dayKey } from '@/lib/jobFormat'

// The countdown on a job counts down to the day you leave, not the day the job starts:
// "2 days" means two days until the travel day. On the day itself it says Travel Day, and
// once the job is on it says Job Day. The list and the job page both use this, so they agree.

type TripJob = Pick<Fldr, 'date_start' | 'date_end' | 'flight_info' | 'job_info'>

export type TripPhaseKind =
  /** Before the travel day: `days` counts down to it */
  | 'before'
  /** Today is the day to leave */
  | 'travel-day'
  /** Under way: left already, the job has not started; `days` counts down to the job */
  | 'between'
  /** The job is on today */
  | 'job-day'
  /** The job is over */
  | 'done'

export interface TripPhase {
  kind: TripPhaseKind
  /** Days to whatever the countdown is counting to (the travel day, or the job's first day once under way) */
  days: number
  /** Days to the job's first day, whatever the countdown is counting to */
  daysToJob: number
  /** The job has a travel day of its own (a flight, or travel dates); otherwise the job's first day is the one that counts */
  hasTravel: boolean
}

function formatLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Whole days from one "YYYY-MM-DD" day to another, so daylight saving can't shift the count */
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000)
}

/**
 * The day the trip starts, when there is one: the first flight out, or the "leaving" day in the
 * travel dates, whichever is earlier. A date after the job begins can't be the day you leave
 * (it's the flight home), so it's ignored. Null when nothing says you travel.
 */
export function travelDayKey(job: TripJob): string | null {
  const start = dayKey(job.date_start)
  if (!start) return null
  const candidates: string[] = []
  for (const segment of Array.isArray(job.flight_info) ? job.flight_info : []) {
    const day = dayKey(segment.departure_time)
    if (day) candidates.push(day)
  }
  const leaving = dayKey(job.job_info?.travel_start)
  if (leaving) candidates.push(leaving)
  const usable = candidates.filter(day => day <= start).sort()
  return usable[0] ?? null
}

/** Where a job is in its run-up: how far from leaving, leaving today, on the road, on the job, or finished */
export function tripPhase(job: TripJob, today: string = formatLocal(new Date())): TripPhase {
  const start = dayKey(job.date_start) || today
  const end = dayKey(job.date_end) || start
  const travel = travelDayKey(job)
  const daysToJob = daysBetween(today, start)
  const leaves = travel ?? start

  if (today > end) return { kind: 'done', days: 0, daysToJob, hasTravel: !!travel }
  if (today < leaves) return { kind: 'before', days: daysBetween(today, leaves), daysToJob, hasTravel: !!travel }
  if (travel && today === travel) return { kind: 'travel-day', days: 0, daysToJob, hasTravel: true }
  if (today < start) return { kind: 'between', days: daysToJob, daysToJob, hasTravel: !!travel }
  return { kind: 'job-day', days: 0, daysToJob, hasTravel: !!travel }
}

const unit = (n: number) => (n === 1 ? 'Day' : 'Days')

/** The pills on the job page: what the countdown counts to, and the job's own start when that is later */
export function tripPills(phase: TripPhase): string[] {
  switch (phase.kind) {
    case 'before':
      return phase.hasTravel
        ? [`${phase.days} ${unit(phase.days)} Until Travel`, ...(phase.daysToJob > 0 ? [`${phase.daysToJob} ${unit(phase.daysToJob)} Until Job`] : [])]
        : [`${phase.days} ${unit(phase.days)} Until Job`]
    case 'travel-day':
      return ['Travel Day', ...(phase.daysToJob > 0 ? [`${phase.daysToJob} ${unit(phase.daysToJob)} Until Job`] : [])]
    case 'between':
      return [`${phase.days} ${unit(phase.days)} Until Job`]
    case 'job-day':
      return ['Job Day']
    default:
      return []
  }
}
