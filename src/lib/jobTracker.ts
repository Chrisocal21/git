import type { Fldr, JobTracker, TrackerStep, TrackerStepKey } from '@/types/fldr'
import { dayKey, fmtClock, fmtTime, fmtTimeSpan, parseLocal } from '@/lib/jobFormat'
import { todayKey } from '@/lib/jigsFormat'

// ── The logistics list ──────────────────────────────────────────────────────

export interface StepGroup {
  key: string
  label: string
  steps: TrackerStepKey[]
}

// Same order as the columns on the event tracker sheet
export const STEP_GROUPS: StepGroup[] = [
  { key: 'paperwork', label: 'Paperwork', steps: ['po_received', 'contract_sent', 'contract_signed', 'invoice_sent', 'deposit_paid'] },
  { key: 'travel', label: 'Travel', steps: ['travel_booked'] },
  { key: 'product', label: 'Product', steps: ['mockups_sent', 'mockups_approved', 'product_shipped'] },
  { key: 'builder', label: 'Event Builder', steps: ['input_form_created'] },
  { key: 'signage', label: 'Signage', steps: ['signage_created'] },
  { key: 'sms', label: 'Custom SMS', steps: ['custom_sms_created'] },
]

export const STEP_LABELS: Record<TrackerStepKey, string> = {
  po_received: 'PO Received',
  contract_sent: 'Contract Sent',
  contract_signed: 'Contract Signed',
  invoice_sent: '50% Invoice Sent',
  deposit_paid: 'Deposit Paid',
  travel_booked: 'Travel Booked',
  mockups_sent: 'Mockups Sent',
  mockups_approved: 'Mockups Approved',
  product_shipped: 'Product Shipped',
  input_form_created: 'Input Form / Event Builder Created',
  signage_created: 'Signage Created',
  custom_sms_created: 'Custom SMS Created',
}

const UNTOUCHED: TrackerStep = { state: 'todo', date: null, note: null }

/** What's saved for a step, or a blank one if nobody has touched it */
export function readStep(tracker: JobTracker | null | undefined, key: TrackerStepKey): TrackerStep {
  const saved = tracker?.[key]
  if (!saved) return UNTOUCHED
  return { state: saved.state ?? 'todo', date: saved.date ?? null, note: saved.note ?? null }
}

/** A "No" on the question above takes its follow-up step off the list */
export function stepApplies(tracker: JobTracker | null | undefined, key: TrackerStepKey): boolean {
  if (key === 'signage_created') return tracker?.signage_required !== 'no'
  if (key === 'custom_sms_created') return tracker?.custom_sms_needed !== 'no'
  return true
}

export interface GroupProgress {
  key: string
  label: string
  done: number
  total: number
}

export interface TrackerProgress {
  done: number
  total: number
  /** Steps still to do, in list order */
  upNext: TrackerStepKey[]
  groups: GroupProgress[]
}

/** Counts what's done. Steps marked N/A, or ruled out by a "No", don't count either way. */
export function trackerProgress(tracker: JobTracker | null | undefined): TrackerProgress {
  const upNext: TrackerStepKey[] = []
  let done = 0
  let total = 0
  const groups = STEP_GROUPS.map(group => {
    let groupDone = 0
    let groupTotal = 0
    for (const key of group.steps) {
      const { state } = readStep(tracker, key)
      if (state === 'na' || !stepApplies(tracker, key)) continue
      groupTotal++
      if (state === 'done') groupDone++
      else upNext.push(key)
    }
    done += groupDone
    total += groupTotal
    return { key: group.key, label: group.label, done: groupDone, total: groupTotal }
  })
  return { done, total, upNext, groups }
}

// ── The trip, start to end ──────────────────────────────────────────────────

export type TimelineKind = 'date' | 'ship' | 'flight' | 'hotel' | 'car' | 'event'

export interface TimelineItem {
  id: string
  kind: TimelineKind
  /** Sort position, ms */
  at: number
  day: string
  /** Set when it runs over several days */
  endDay: string | null
  title: string
  detail: string | null
  /** Over and done with */
  past: boolean
  /** The first thing still ahead */
  next: boolean
}

type Draft = Omit<TimelineItem, 'past' | 'next' | 'at' | 'day' | 'endDay'> & {
  start: string
  end?: string | null
}

function join(parts: Array<string | null | undefined | false>): string | null {
  const text = parts.filter(Boolean).join(' · ')
  return text || null
}

/**
 * Everything with a date on a job, in order: the calls beforehand, product landing,
 * flights out, the hotel, the event itself and the way home.
 */
export function buildTimeline(fldr: Fldr, now: Date = new Date()): TimelineItem[] {
  const drafts: Draft[] = []
  const info = fldr.job_info
  const tracker = fldr.tracker

  if (info?.kickoff_date) drafts.push({ id: 'kickoff', kind: 'date', title: 'Kick-off', detail: null, start: info.kickoff_date })
  if (info?.prepro_date) drafts.push({ id: 'prepro', kind: 'date', title: 'Pre-pro', detail: null, start: info.prepro_date })

  const arrivalStart = tracker?.product_arrival_start || tracker?.product_arrival_end
  if (arrivalStart) {
    drafts.push({
      id: 'product',
      kind: 'ship',
      title: 'Product Arrives',
      detail: null,
      start: arrivalStart,
      end: tracker?.product_arrival_end,
    })
  }

  const flights = Array.isArray(fldr.flight_info) ? fldr.flight_info : []
  const timedFlights = flights.filter(seg => seg.departure_time || seg.arrival_time)
  for (const seg of timedFlights) {
    const from = seg.departure_code || seg.departure_airport || '?'
    const to = seg.arrival_code || seg.arrival_airport || '?'
    drafts.push({
      id: `flight-${seg.id}`,
      kind: 'flight',
      title: `${from} → ${to}`,
      detail: join([
        fmtTime(seg.departure_time),
        [seg.airline, seg.flight_number].filter(Boolean).join(' '),
        seg.travelers?.join(', '),
      ]),
      start: (seg.departure_time || seg.arrival_time) as string,
    })
  }
  // Before flights are in, the travel dates stand in for them
  if (timedFlights.length === 0) {
    if (info?.travel_start) drafts.push({ id: 'travel-out', kind: 'flight', title: 'Travel Out', detail: null, start: info.travel_start })
    if (info?.travel_end && info.travel_end !== info.travel_start) {
      drafts.push({ id: 'travel-home', kind: 'flight', title: 'Travel Home', detail: null, start: info.travel_end })
    }
  }

  const hotel = fldr.hotel_info
  if (hotel?.check_in) {
    drafts.push({ id: 'hotel-in', kind: 'hotel', title: 'Hotel Check-in', detail: join([fmtTime(hotel.check_in), hotel.name]), start: hotel.check_in })
  }
  if (hotel?.check_out) {
    drafts.push({ id: 'hotel-out', kind: 'hotel', title: 'Hotel Check-out', detail: join([fmtTime(hotel.check_out), hotel.name]), start: hotel.check_out })
  }

  const car = fldr.rental_car_info
  if (car?.pickup_time) {
    drafts.push({ id: 'car-pickup', kind: 'car', title: 'Rental Car Pickup', detail: join([fmtTime(car.pickup_time), car.company]), start: car.pickup_time })
  }
  if (car?.dropoff_time) {
    drafts.push({ id: 'car-dropoff', kind: 'car', title: 'Rental Car Dropoff', detail: join([fmtTime(car.dropoff_time), car.company]), start: car.dropoff_time })
  }

  if (fldr.fldr_type === 'time_off') {
    if (fldr.date_start) {
      drafts.push({ id: 'time-off', kind: 'date', title: 'Time Off', detail: null, start: fldr.date_start, end: fldr.date_end })
    }
  } else {
    const venue = fldr.venue_info?.name
    if (info?.show_up_time) {
      drafts.push({ id: 'show-up', kind: 'event', title: 'Show Up', detail: join([fmtTime(info.show_up_time), venue]), start: info.show_up_time })
    }
    if (info?.use_daily_schedule) {
      const hours = [fmtClock(info.daily_start_time), fmtClock(info.daily_end_time)].filter(Boolean).join(' – ')
      drafts.push({
        id: 'event',
        kind: 'event',
        title: 'Event',
        detail: join([hours && (fldr.date_end ? `${hours} daily` : hours), !info.show_up_time && venue]),
        start: fldr.date_start,
        end: fldr.date_end,
      })
    } else if (info?.job_start_time) {
      drafts.push({
        id: 'event',
        kind: 'event',
        title: 'Event',
        detail: join([fmtTimeSpan(info.job_start_time, info.job_end_time), !info.show_up_time && venue]),
        start: info.job_start_time,
        end: info.job_end_time,
      })
    } else if (fldr.date_start) {
      drafts.push({
        id: 'event',
        kind: 'event',
        title: 'Event',
        detail: join([info?.job_end_time ? fmtTimeSpan(null, info.job_end_time) : null, !info?.show_up_time && venue]),
        start: fldr.date_start,
        end: fldr.date_end,
      })
    }
  }

  const today = todayKey()
  const items: TimelineItem[] = []
  for (const draft of drafts) {
    const startDate = parseLocal(draft.start)
    const day = dayKey(draft.start)
    if (!startDate || !day) continue
    const lastDay = dayKey(draft.end) ?? day
    // A timed, single-day entry is over once its time passes; anything else is over when its last day is
    const timed = fmtTime(draft.start) !== '' && lastDay === day
    const past = timed ? startDate.getTime() < now.getTime() : lastDay < today
    items.push({
      id: draft.id,
      kind: draft.kind,
      at: startDate.getTime(),
      day,
      endDay: lastDay !== day ? lastDay : null,
      title: draft.title,
      detail: draft.detail,
      past,
      next: false,
    })
  }

  items.sort((a, b) => a.at - b.at)
  const upcoming = items.find(item => !item.past)
  if (upcoming) upcoming.next = true
  return items
}

/** First departure day to last arrival day across the flights on file */
export function flightSpan(fldr: Fldr): { start: string; end: string } | null {
  const days: string[] = []
  for (const seg of Array.isArray(fldr.flight_info) ? fldr.flight_info : []) {
    const out = dayKey(seg.departure_time)
    const back = dayKey(seg.arrival_time)
    if (out) days.push(out)
    if (back) days.push(back)
  }
  if (days.length === 0) return null
  days.sort()
  return { start: days[0], end: days[days.length - 1] }
}

// ── What a job still needs ──────────────────────────────────────────────────

export interface MissingItem {
  key: string
  label: string
  /** The card where it gets filled in */
  card: string
}

/** The details every event needs before anyone travels, that aren't filled in yet */
export function missingEssentials(fldr: Fldr): MissingItem[] {
  const info = fldr.job_info
  const missing: MissingItem[] = []
  if (!info?.client_name) missing.push({ key: 'client', label: 'Client', card: 'event' })
  if (!info?.client_contact_name && !info?.client_contact_phone && !info?.client_contact_email) {
    missing.push({ key: 'contact', label: 'Contact', card: 'event' })
  }
  if (!info?.item && !(fldr.products && fldr.products.some(p => p.name))) {
    missing.push({ key: 'gifts', label: 'Gift/s', card: 'event' })
  }
  if (!fldr.venue_info?.address) missing.push({ key: 'address', label: 'Event Address', card: 'venue' })
  const hasTime = info?.show_up_time || info?.job_start_time || (info?.use_daily_schedule && info.daily_start_time)
  if (!hasTime) missing.push({ key: 'time', label: 'Time', card: 'venue' })
  if (!(fldr.people && fldr.people.some(p => p.name && p.name.trim()))) {
    missing.push({ key: 'staff', label: 'Staff', card: 'people' })
  }
  return missing
}
